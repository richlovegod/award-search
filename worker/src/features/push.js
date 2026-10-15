// 推播通知 (Web Push for alerts), 2026-10-15. When an alert emails new or cheaper awards, the same news goes to the
// account's devices that turned push on (我的提醒 > 📱 推播通知). Everything here is WebCrypto only:
//   VAPID (RFC 8292): each request carries a JWT signed ES256 with our key pair, aud = the push service's origin,
//     12 hours valid, sub = VAPID_SUBJECT or mailto:gino@ginochang.com, plus our public key (k=).
//   Payload encryption (RFC 8291 on RFC 8188 aes128gcm): a fresh ECDH P-256 key pair per message, the shared secret
//     with the browser's p256dh key and its 16-byte auth secret through HKDF-SHA-256, one AES-128-GCM record.
// Secrets: VAPID_PRIVATE_JWK (the private key as a JWK JSON string) and VAPID_PUBLIC (base64url of the 65-byte
// public point; not secret, a var works too). Both come from C:\Users\chunju\.claude\secrets\vapid.json. Without
// them GET /push/key answers { key: null }, 測試推播 503 { error: 'push_off' }, and alerts send no pushes.
// Var VAPID_SUBJECT is optional. A subscription row is removed when its push service answers 404 or 410.
// Push follows sign-in: each row keeps the session that registered it, is deleted with that session (登出, 登出其他
// 所有裝置, a password change; ON DELETE CASCADE), and gets nothing once the session has expired. The page registers
// its subscription again after each sign-in.
export const name = 'push';

const MAX_DEVICES = 10;                     // per account
const TEST_LIMIT = [5, 3600];               // 測試推播: 5 an hour per account (KV counter)
const TTL_ALERT = 86400, TTL_TEST = 600;    // how long a push service keeps trying a phone that is off
// push services the browsers use; the Worker only ever POSTs to these, so an endpoint can't aim it anywhere else
const HOSTS = ['push.apple.com', 'fcm.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com'];
const RS = 4096;                            // record size; one record, so a payload is at most RS - 17 bytes
const MAX_PLAIN = RS - 17 - 86;             // and the whole body (86-byte header) stays within 4,096 bytes
const enc = new TextEncoder();

/* ---------- bytes ---------- */
export function b64u(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s) {
  const b = String(s).replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b + '='.repeat((4 - b.length % 4) % 4)), c => c.charCodeAt(0));
}
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

/* ---------- RFC 8291 payload encryption ---------- */
async function hkdf(salt, ikm, info, bytes) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bytes * 8));
}
// p256dh, auth: the subscription's keys (base64url or bytes); plain: the bytes to send.
// fixed { keys, salt } is for the RFC 8291 test vector only; normal calls make both fresh.
export async function encryptPayload(p256dh, auth, plain, fixed = {}) {
  const uaPub = typeof p256dh === 'string' ? unb64u(p256dh) : p256dh;
  const secret = typeof auth === 'string' ? unb64u(auth) : auth;
  if (uaPub.length !== 65 || uaPub[0] !== 4 || secret.length !== 16) throw new Error('bad subscription keys');
  if (plain.length > MAX_PLAIN) throw new Error('payload too big');
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const as = fixed.keys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" 0x00 ua_public as_public, 32)
  const ikm = await hkdf(secret, ecdh, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = fixed.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // one record: the payload, then the last-record delimiter 0x02 and no padding
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plain, Uint8Array.of(2))));
  // header: salt (16) | record size (uint32) | key id length (1) | key id = as_public (65)
  const head = new Uint8Array(21);
  head.set(salt);
  new DataView(head.buffer).setUint32(16, RS);
  head[20] = asPub.length;
  return concat(head, asPub, ct);
}

/* ---------- RFC 8292 VAPID ---------- */
let VAPID = null;   // { src, raw, pub, key } of the env's key pair, imported once per isolate
// { key: the private CryptoKey, pub: base64url public point }, or null when the secrets are missing or don't match
export async function vapid(env) {
  const src = env.VAPID_PRIVATE_JWK, raw = String(env.VAPID_PUBLIC || '').trim();
  if (!src || !raw) return null;
  if (!VAPID || VAPID.src !== src || VAPID.raw !== raw) {
    let key = null, pub = '';
    try {
      const j = typeof src === 'string' ? JSON.parse(src) : src;
      const point = unb64u(raw);
      // the public key must be the private key's own point, or every push service would refuse the JWT
      if (point.length !== 65 || point[0] !== 4 || b64u(point.slice(1, 33)) !== j.x || b64u(point.slice(33)) !== j.y) throw new Error('VAPID_PUBLIC does not match VAPID_PRIVATE_JWK');
      key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: j.x, y: j.y, d: j.d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
      pub = b64u(point);
    } catch (e) {
      console.error('push: VAPID keys unusable:', e && e.message);
      key = null;
    }
    VAPID = { src, raw, pub, key };
  }
  return VAPID.key ? VAPID : null;
}
export async function vapidJwt(key, aud, sub, exp) {
  const part = o => b64u(enc.encode(JSON.stringify(o)));
  const unsigned = part({ typ: 'JWT', alg: 'ES256' }) + '.' + part({ aud, exp, sub });
  // WebCrypto's ECDSA signature is r || s (64 bytes), the form JWS ES256 wants
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned));
  return unsigned + '.' + b64u(sig);
}

/* ---------- input checks ---------- */
export function cleanEndpoint(v) {
  if (typeof v !== 'string' || v.length > 1024 || /[\s\u0000-\u001f\u007f]/.test(v)) return null;
  let u;
  try { u = new URL(v); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  return HOSTS.some(x => host === x || host.endsWith('.' + x)) ? v : null;
}
// { p256dh, auth } as unpadded base64url, or null; p256dh must be a point on P-256 (importKey checks it)
export async function cleanKeys(k) {
  if (!k || typeof k !== 'object' || typeof k.p256dh !== 'string' || typeof k.auth !== 'string') return null;
  if (!/^[A-Za-z0-9_+/-]{86,88}={0,2}$/.test(k.p256dh) || !/^[A-Za-z0-9_+/-]{22,24}={0,2}$/.test(k.auth)) return null;
  let p, a;
  try { p = unb64u(k.p256dh); a = unb64u(k.auth); } catch { return null; }
  if (p.length !== 65 || p[0] !== 4 || a.length !== 16) return null;
  try { await crypto.subtle.importKey('raw', p, { name: 'ECDH', namedCurve: 'P-256' }, false, []); } catch { return null; }
  return { p256dh: b64u(p), auth: b64u(a) };
}
const cleanUa = v => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 300) || null;
const ID = /^[A-Za-z0-9_-]{43}$/;   // a row's id: base64url SHA-256 of its endpoint, which the page can compute too

/* ---------- sending ---------- */
// one short reason from a refusal, e.g. "403 BadJwtToken"
async function reasonOf(r) {
  let text = '';
  try { text = (await r.text()).slice(0, 400); } catch {}
  let why = '';
  try { const j = JSON.parse(text); why = j.reason || (j.error && (j.error.message || j.error)) || j.message || ''; } catch {}
  if (!why) why = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return (r.status + ' ' + String(why)).trim().slice(0, 80);
}
// msg = { title, body, url, tag } to every subscription in subs; then deletes the ones that are gone (404, 410) and
// notes when each last worked or failed. One device failing never stops the others. Answers { sent, removed, failed }
// (all 0 when push is not set up: no VAPID secrets is not a delivery failure, and nothing is sent or noted).
export async function sendAll(env, lib, subs, msg, { ttl = TTL_ALERT, urgency = 'high' } = {}) {
  const out = { sent: 0, removed: 0, failed: 0 };
  if (!subs.length) return out;
  const v = await vapid(env);
  if (!v) return out;
  const sub = env.VAPID_SUBJECT || 'mailto:gino@ginochang.com', exp = lib.now() + 12 * 3600, jwts = new Map();
  const plain = enc.encode(JSON.stringify(msg));
  const results = await Promise.all(subs.map(async s => {
    try {
      const aud = new URL(s.endpoint).origin;
      if (!jwts.has(aud)) jwts.set(aud, vapidJwt(v.key, aud, sub, exp));
      const r = await fetch(s.endpoint, {
        method: 'POST',
        headers: {
          Authorization: 'vapid t=' + await jwts.get(aud) + ', k=' + v.pub,
          'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: urgency,
        },
        body: await encryptPayload(s.p256dh, s.auth, plain),
      });
      // read every answer to its end, so its connection frees up for the next send (6 at a time per run)
      const why = r.ok ? await r.text().then(() => '', () => '') : await reasonOf(r);
      return { s, status: r.status, why };
    } catch (e) {
      return { s, status: 0, why: ('error ' + (e && e.message || e)).slice(0, 80) };
    }
  }));
  const t = lib.now(), st = [];
  for (const x of results) {
    if (x.status === 404 || x.status === 410) {
      out.removed++;
      st.push(env.DB.prepare('DELETE FROM push_subs WHERE id = ?').bind(x.s.id));
    } else if (x.status >= 200 && x.status < 300) {
      out.sent++;
      st.push(env.DB.prepare('UPDATE push_subs SET last_ok_at = ?, last_err = NULL, last_err_at = NULL WHERE id = ?').bind(t, x.s.id));
    } else {
      out.failed++;
      console.error('push refused', new URL(x.s.endpoint).host, x.why);
      st.push(env.DB.prepare('UPDATE push_subs SET last_err = ?, last_err_at = ? WHERE id = ?').bind(x.why || String(x.status), t, x.s.id));
    }
  }
  try { await env.DB.batch(st); } catch (e) { console.error('push bookkeeping', e && e.message); }
  return out;
}

/* ---------- the notification for an alert ---------- */
const num = v => (typeof v === 'number' ? v : parseInt(v, 10)) || 0;
const CABIN = { zh: { Y: '經濟艙', W: '豪華經濟艙', J: '商務艙', F: '頭等艙' }, en: { Y: 'Economy', W: 'Premium Economy', J: 'Business', F: 'First' } };
const WD = { zh: '日一二三四五六', en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
// 11/3 週二 or Tue 11/3 (週, not （二）, since the day sits inside the body's own parentheses)
function dayText(iso, L) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '';
  const md = +iso.slice(5, 7) + '/' + +iso.slice(8, 10), w = WD[L][new Date(iso + 'T00:00:00Z').getUTCDay()];
  return L === 'en' ? w + ' ' + md : md + ' 週' + w;
}
// alert: the alerts row (plus the account's email); fresh: the new or cheaper awards the email listed, or for a
// round trip the date pairs, each { ...outbound award, back: return award, total }
export function alertMessage(env, lib, a, fresh) {
  const L = a.lang === 'en' ? 'en' : 'zh', en = L === 'en';
  const val = x => num(x.total != null ? x.total : x.miles);
  let best = fresh[0];
  for (const x of fresh) if (val(x) < val(best)) best = x;
  const n = fresh.length, min = lib.fmtN(val(best));
  const rt = !!a.rs;
  let body = rt ? (en ? `${n} new date pair${n === 1 ? '' : 's'} from ${min} miles in total` : `${n} 組新的日期，最低合計 ${min} 哩`)
    : (en ? `${n} new award${n === 1 ? '' : 's'} from ${min} miles` : `${n} 筆新的位子，最低 ${min} 哩`);
  // the cheapest one: its days (and its program, one way)
  const d1 = dayText(best.date, L), d2 = rt && best.back ? dayText(best.back.date, L) : '';
  const detail = rt ? (d1 && d2 ? (en ? `out ${d1}, back ${d2}` : `去 ${d1}，回 ${d2}`) : '')
    : [d1, best.src ? lib.PROGRAM_NAME[best.src] || best.src : ''].filter(Boolean).join(en ? ', ' : '，');
  if (detail) body += en ? ` (${detail})` : `（${detail}）`;
  if (a.label) body = a.label + (en ? ': ' : '：') + body;
  const site = env.SITE_URL || 'https://award.ginochang.com/';
  return { title: '✈️ ' + lib.routeText(a) + ' ' + (CABIN[L][a.cabin] || a.cabin), body: body.slice(0, 300), url: site + '#/alert/' + a.id, tag: 'alert-' + a.id };
}

const TEST_WORDS = {
  zh: { title: '🔔 測試推播', body: '推播設定好了。提醒找到新位子時，會像這樣通知你。' },
  en: { title: '🔔 Test notification', body: 'Push works. When an alert finds new seats, you will get a notification like this.' },
};

/* ---------- routes ---------- */
// rows whose sign-in is still live; the others belong to a device that signed out or whose sign-in expired
const LIVE = 'JOIN sessions x ON x.id = p.session_id AND x.user_id = p.user_id AND x.expires_at > ?';
const nowOf = lib => (lib && typeof lib.now === 'function' ? lib.now() : Math.floor(Date.now() / 1000));
const listSubs = (env, lib, uid) => env.DB.prepare('SELECT p.id, p.endpoint, p.p256dh, p.auth FROM push_subs p ' + LIVE + ' WHERE p.user_id = ?')
  .bind(nowOf(lib), uid).all().then(r => r.results || []);
// for other feature modules: one notification { title, body, url, tag } to every signed-in device of one account.
// Never throws; answers { sent, removed, failed } (all 0 when the account has no device or the VAPID secrets are
// missing).
export async function pushToUser(env, lib, uid, msg, opts) {
  try {
    const subs = await listSubs(env, lib, uid);
    return subs.length ? await sendAll(env, lib, subs, msg, opts) : { sent: 0, removed: 0, failed: 0 };
  } catch (e) {
    console.error('push pushToUser', e && e.message);
    return { sent: 0, removed: 0, failed: 0 };
  }
}

export const routes = [
  // the VAPID public key the page subscribes with; null while the secrets are missing (a normal state, so not a
  // 5xx: browsers log those as errors on every visit to 我的提醒)
  { method: 'GET', path: '/push/key', auth: 'user', handler: async ({ env, h, lib }) => {
    const v = await vapid(env);
    return lib.json({ key: v ? v.pub : null }, 200, h);
  } },
  // this account's signed-in devices
  { method: 'GET', path: '/me/push', auth: 'user', handler: async ({ env, s, h, lib }) => {
    const r = await env.DB.prepare('SELECT p.id, p.ua, p.created_at, p.last_ok_at, p.last_err, p.last_err_at FROM push_subs p ' + LIVE +
      ' WHERE p.user_id = ? ORDER BY p.created_at DESC').bind(lib.now(), s.id).all();
    return lib.json({ devices: r.results || [], max: MAX_DEVICES, ready: !!(await vapid(env)) }, 200, h);
  } },
  // { endpoint, keys: { p256dh, auth }, ua }: this device's subscription, tied to this sign-in. The same endpoint
  // again updates its row (and moves it to this account and session); a new endpoint from the same sign-in replaces
  // that sign-in's old one (a browser has one per site). Nothing is written when nothing would change, so a page
  // that posts at every sign-in or a loop costs reads only.
  { method: 'POST', path: '/me/push', auth: 'user', handler: async ({ req, env, s, h, lib }) => {
    const b = await lib.readJson(req);
    const endpoint = cleanEndpoint(b.endpoint), keys = endpoint ? await cleanKeys(b.keys) : null;
    if (!endpoint || !keys) return lib.json({ error: 'push_bad' }, 400, h);
    const id = await lib.sha256(endpoint), ua = cleanUa(b.ua), t = lib.now();
    const old = await env.DB.prepare('SELECT user_id, session_id, p256dh, auth, ua FROM push_subs WHERE id = ?').bind(id).first();
    if (old && old.user_id === s.id && old.session_id === s.sid && old.p256dh === keys.p256dh && old.auth === keys.auth && old.ua === ua) return lib.json({ id }, 200, h);
    // the other signed-in devices (this sign-in's own older endpoint is about to be replaced)
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs p ' + LIVE + ' WHERE p.user_id = ? AND p.id != ? AND p.session_id != ?').bind(t, s.id, id, s.sid).first();
    if (n.n >= MAX_DEVICES) return lib.json({ error: 'push_max', max: MAX_DEVICES }, 400, h);
    try {
      await env.DB.batch([
        // this sign-in's older endpoint, and this account's rows whose sign-in has ended
        env.DB.prepare('DELETE FROM push_subs WHERE user_id = ? AND id != ? AND (session_id = ? OR NOT EXISTS ' +
          '(SELECT 1 FROM sessions x WHERE x.id = push_subs.session_id AND x.user_id = push_subs.user_id AND x.expires_at > ?))').bind(s.id, id, s.sid, t),
        env.DB.prepare(
          'INSERT INTO push_subs (id, user_id, session_id, endpoint, p256dh, auth, ua, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(id) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, session_id = excluded.session_id, ' +
          'created_at = CASE WHEN user_id = excluded.user_id THEN created_at ELSE excluded.created_at END, ' +
          'last_ok_at = CASE WHEN user_id = excluded.user_id THEN last_ok_at ELSE NULL END, ' +
          'last_err = NULL, last_err_at = NULL, user_id = excluded.user_id')
          .bind(id, s.id, s.sid, endpoint, keys.p256dh, keys.auth, ua, t),
      ]);
    } catch (e) {
      // the session was deleted (signed out elsewhere) between the sign-in check and this write
      if (/FOREIGN KEY/i.test(String(e && e.message))) return lib.json({ error: 'auth' }, 401, h);
      throw e;
    }
    return lib.json({ id }, 200, h);
  } },
  // { endpoint } from the device itself (關閉), or { id } from the device list (移除)
  { method: 'DELETE', path: '/me/push', auth: 'user', handler: async ({ req, env, s, h, lib }) => {
    const b = await lib.readJson(req);
    const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : typeof b.endpoint === 'string' && b.endpoint.length <= 1024 ? await lib.sha256(b.endpoint) : null;
    if (!id) return lib.json({ error: 'param' }, 400, h);
    await env.DB.prepare('DELETE FROM push_subs WHERE id = ? AND user_id = ?').bind(id, s.id).run();
    return lib.json({ ok: true }, 200, h);
  } },
  // 測試推播: one notification to every device of this account; { lang } picks its words
  { method: 'POST', path: '/me/push/test', auth: 'user', handler: async ({ req, env, s, h, lib }) => {
    if (!(await vapid(env))) return lib.json({ error: 'push_off' }, 503, h);
    const rl = 'rl:push:' + s.id;
    if (await lib.tooMany(env, rl, TEST_LIMIT)) return lib.json({ error: 'push_rate' }, 429, h);
    const b = await lib.readJson(req), subs = await listSubs(env, lib, s.id);
    if (!subs.length) return lib.json({ error: 'push_none' }, 400, h);
    await lib.bump(env, rl, TEST_LIMIT);
    const W = TEST_WORDS[b.lang === 'en' ? 'en' : 'zh'];
    const r = await sendAll(env, lib, subs, { title: W.title, body: W.body, url: (env.SITE_URL || 'https://award.ginochang.com/') + '#/alerts', tag: 'push-test' }, { ttl: TTL_TEST });
    return lib.json({ devices: subs.length, ...r }, 200, h);
  } },
];

/* ---------- hooks ---------- */
// after an alert emailed new or cheaper awards: the same news to the alert owner's devices
export async function onAlertHit({ env, ctx, lib, alert, fresh }) {
  try {
    if (!alert || !Array.isArray(fresh) || !fresh.length || !env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC) return;
    const subs = await listSubs(env, lib, alert.user_id);
    if (!subs.length) return;
    const job = sendAll(env, lib, subs, alertMessage(env, lib, alert, fresh)).catch(e => console.error('push alert', e && e.message));
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(job); else await job;
  } catch (e) {
    console.error('push onAlertHit', e && e.message);
  }
}

// the hourly cron: drop rows whose sign-in has ended. Deleted sessions already took their rows with them (ON DELETE
// CASCADE), so this catches the expired ones (nothing is ever sent to those either). One statement on a small table.
export async function hourly({ env, at }) {
  const r = await env.DB.prepare('DELETE FROM push_subs WHERE NOT EXISTS ' +
    '(SELECT 1 FROM sessions x WHERE x.id = push_subs.session_id AND x.user_id = push_subs.user_id AND x.expires_at > ?)').bind(at).run();
  return { signedOut: (r && r.meta && r.meta.changes) || 0 };
}

export function onDeleteUser(env, uid) {
  return env.DB.prepare('DELETE FROM push_subs WHERE user_id = ?').bind(uid);
}
