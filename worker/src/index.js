// award-relay: accounts for the award search site, plus a relay that keeps the seats.aero key on Cloudflare.
//
// Phase 1 sign-in (no outgoing email):
//   users        one row per account; the password is kept only as a salted PBKDF2 hash
//   sessions     one row per signed-in device; the browser holds a random token, D1 holds its SHA-256
//   invites      registering needs a one-time invite code made by the owner; the code is looked up by its SHA-256
//                and also kept AES-GCM encrypted (key: INVITE_KEY) so the admin page can show it again
//   reset_links  the owner makes one-time links for anyone who forgot a password
// Every account searches with the owner's seats.aero key (SEATS_KEY), so the site is for the owner's own accounts only.
// Bindings: DB (D1 award-auth; also the quota row), KV (lockout counters), ALERT_MAIL (send_email, alert emails).
// Secrets: SEATS_KEY, INVITE_KEY, CF_API_TOKEN (Email Routing Addresses: Edit, to add alert recipients).
// Vars: ALLOWED_ORIGINS, SITE_URL, CF_ACCOUNT, MAIL_FROM. A cron trigger runs the alerts (see "email alerts").
import { EmailMessage } from 'cloudflare:email';
import { FEATURES } from './features/index.js';

const UPSTREAM = 'https://seats.aero/partnerapi';
const PBKDF2_ITER = 100000;        // the most Workers allows; measured 19 to 26 ms CPU per hash (2026-10-13)
const SESSION_LONG = 30 * 86400;   // "記住我"
const SESSION_SHORT = 86400;
const INVITE_DAYS = 30;
const RESET_MINUTES = 30;
// [allowed failures, window in seconds]
const LIMITS = { email: [5, 900], ip: [20, 900], register: [10, 3600], reset: [10, 3600], mail: [3, 3600] };
// Checked against when an email has no account, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = 'pbkdf2-sha256$100000$uG1ixDccdr0X91w8RTnQpQ$LVfysNSOW-IeDeMSAr5DjWO12wIAeX0didLnbIFSWig';
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I, so codes read aloud cleanly

// Query parameters the site may pass to /search, and the shape each value must have.
const SEARCH_RULES = {
  origin_airport: /^[A-Z]{3}(,[A-Z]{3}){0,19}$/,
  destination_airport: /^[A-Z]{3}(,[A-Z]{3}){0,19}$/,
  start_date: /^\d{4}-\d{2}-\d{2}$/,
  end_date: /^\d{4}-\d{2}-\d{2}$/,
  cabins: /^[a-z]+(,[a-z]+){0,3}$/,
  sources: /^[a-z0-9]+(,[a-z0-9]+){0,40}$/,
  carriers: /^[A-Z0-9]{2}(,[A-Z0-9]{2}){0,30}$/,
  only_direct_flights: /^(true|false)$/,
  include_trips: /^(true|false)$/,
  minify_trips: /^(true|false)$/,
  include_filtered: /^(true|false)$/,
  order_by: /^lowest_mileage$/,
  take: /^\d{2,4}$/,
  skip: /^\d{1,6}$/,
  cursor: /^\d{1,20}$/,
  min_cabin_pct: /^\d{1,3}$/,
};

const enc = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);

/* ---------- small helpers ---------- */

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b + '='.repeat((4 - b.length % 4) % 4)), c => c.charCodeAt(0));
}

const randomToken = bytes => b64url(crypto.getRandomValues(new Uint8Array(bytes)));
const sha256 = async s => b64url(await crypto.subtle.digest('SHA-256', enc.encode(s)));

// Invite codes are stored encrypted, so a copy of the database alone still holds no usable code.
// Stored as base64url(12-byte IV + ciphertext); the invite's id is bound in as additional data,
// so an encrypted code copied onto another row fails to decrypt.
const inviteKey = env => crypto.subtle.importKey('raw', unb64url(env.INVITE_KEY), 'AES-GCM', false, ['encrypt', 'decrypt']);
async function sealCode(env, id, code) {
  if (!env.INVITE_KEY) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(id) }, await inviteKey(env), enc.encode(code)));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return b64url(out);
}
async function openCode(env, id, sealed) {
  if (!sealed || !env.INVITE_KEY) return null;
  try {
    const b = unb64url(sealed);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12), additionalData: enc.encode(id) }, await inviteKey(env), b.slice(12)));
  } catch { return null; }
}
const clientIp = req => req.headers.get('CF-Connecting-IP') || 'local';

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Expose-Headers': 'X-RateLimit-Remaining, X-RateLimit-Limit, X-Rooms-RateLimit-Remaining, X-Rooms-RateLimit-Limit',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(obj, status, h) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...h, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function readJson(req) {
  const text = await req.text();
  if (text.length > 10000) return {};
  try {
    const v = JSON.parse(text || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function cleanEmail(e) {
  e = String(e || '').trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

const cleanPassword = p => String(p == null ? '' : p).normalize('NFC');

function deviceName(ua) {
  ua = ua || '';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : '';
  return [os, browser].filter(Boolean).join(' ') || null;
}

/* ---------- passwords ---------- */

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));   // a new salt for every password
  return `pbkdf2-sha256$${PBKDF2_ITER}$${b64url(salt)}$${b64url(await pbkdf2(password, salt, PBKDF2_ITER))}`;
}

async function verifyPassword(password, stored) {
  const [alg, iter, salt, hash] = String(stored).split('$');
  if (alg !== 'pbkdf2-sha256') return false;
  const got = new Uint8Array(await pbkdf2(password, unb64url(salt), Number(iter)));
  const want = unb64url(hash);
  return got.length === want.length && crypto.subtle.timingSafeEqual(got, want);   // no early exit that leaks timing
}

// How often this password shows up in known breaches (Have I Been Pwned). Only the first 5 characters
// of its SHA-1 leave the Worker (k-anonymity), and padding hides which result was ours.
async function breachCount(password) {
  const sha1 = [...new Uint8Array(await crypto.subtle.digest('SHA-1', enc.encode(password)))]
    .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  try {
    const r = await fetch('https://api.pwnedpasswords.com/range/' + sha1.slice(0, 5), {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'award-search (personal)' },
    });
    if (!r.ok) return 0;
    const line = (await r.text()).split('\n').find(l => l.startsWith(sha1.slice(5)));
    return line ? parseInt(line.split(':')[1], 10) || 0 : 0;
  } catch {
    return 0;   // if the check is down, don't block sign-up
  }
}

async function passwordProblem(password, email) {
  if (password.length < 10) return 'pw_short';
  if (password.length > 128) return 'pw_long';
  if (email && password.toLowerCase() === email) return 'pw_email';
  if (await breachCount(password) > 0) return 'pw_breached';
  return null;
}

/* ---------- lockouts (KV counters that expire on their own) ---------- */

async function tooMany(env, key, [max]) {
  return Number(await env.KV.get(key)) >= max;
}

async function bump(env, key, [max, ttl]) {
  const n = Number(await env.KV.get(key)) + 1;
  await env.KV.put(key, String(n), { expirationTtl: ttl }).catch(() => {});
  return Math.max(0, max - n);
}

/* ---------- sessions ---------- */

async function newSession(env, req, userId, remember) {
  const token = randomToken(32);
  const t = now();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, device, country) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(await sha256(token), userId, t, t + (remember ? SESSION_LONG : SESSION_SHORT), t,
      deviceName(req.headers.get('User-Agent')), req.headers.get('CF-IPCountry') || null)
    .run();
  return token;
}

async function currentSession(req, env) {
  const m = /^Bearer ([A-Za-z0-9_-]{40,64})$/.exec(req.headers.get('Authorization') || '');
  if (!m) return null;
  const sid = await sha256(m[1]);
  const s = await env.DB.prepare(
    'SELECT s.id AS sid, s.expires_at, s.last_seen_at, u.id, u.email, u.role, u.status, u.created_at, u.daily_limit ' +
    'FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?').bind(sid).first();
  if (!s || s.expires_at < now() || s.status !== 'active') return null;
  if (now() - s.last_seen_at > 3600) {   // at most one write an hour per device
    await env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(now(), sid).run();
  }
  return s;
}

const publicUser = u => ({ email: u.email, role: u.role });

/* ---------- sign-up, sign-in, reset ---------- */

async function register(req, env, h) {
  const ipKey = 'rl:reg:' + clientIp(req);
  if (await tooMany(env, ipKey, LIMITS.register)) return json({ error: 'rate' }, 429, h);
  await bump(env, ipKey, LIMITS.register);   // every attempt counts, so invite codes can't be guessed quickly

  const b = await readJson(req);
  const email = cleanEmail(b.email);
  if (!email) return json({ error: 'email_bad' }, 400, h);
  const password = cleanPassword(b.password);
  const code = String(b.invite || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const inviteId = await sha256(code);
  const t = now();

  const invite = code && await env.DB.prepare('SELECT role FROM invites WHERE id = ? AND used_at IS NULL AND expires_at > ?').bind(inviteId, t).first();
  if (!invite) return json({ error: 'invite' }, 400, h);
  if (await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) return json({ error: 'email_taken' }, 409, h);
  const problem = await passwordProblem(password, email);
  if (problem) return json({ error: problem }, 400, h);

  // Claim the code before creating the account, so two sign-ups can't share one code.
  const claim = await env.DB.prepare('UPDATE invites SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(t, inviteId).run();
  if (claim.meta.changes !== 1) return json({ error: 'invite' }, 400, h);
  let user;
  try {
    const ins = await env.DB.prepare('INSERT INTO users (email, pw_hash, role, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)')
      .bind(email, await hashPassword(password), invite.role, t, t).run();
    user = { id: ins.meta.last_row_id, email, role: invite.role };
  } catch {
    await env.DB.prepare('UPDATE invites SET used_at = NULL WHERE id = ?').bind(inviteId).run();
    return json({ error: 'email_taken' }, 409, h);
  }
  await env.DB.prepare('UPDATE invites SET used_by = ? WHERE id = ?').bind(user.id, inviteId).run();
  const token = await newSession(env, req, user.id, b.remember !== false);
  return json({ token, user: publicUser(user) }, 201, h);
}

async function login(req, env, h) {
  const b = await readJson(req);
  const email = cleanEmail(b.email) || '';
  const password = cleanPassword(b.password);
  const ipKey = 'lk:ip:' + clientIp(req);
  const emailKey = 'lk:em:' + await sha256(email);
  if (await tooMany(env, ipKey, LIMITS.ip)) return json({ error: 'ip_locked' }, 429, h);
  if (email && await tooMany(env, emailKey, LIMITS.email)) return json({ error: 'locked' }, 429, h);

  const user = email ? await env.DB.prepare('SELECT id, email, role, status, pw_hash FROM users WHERE email = ?').bind(email).first() : null;
  const ok = await verifyPassword(password, user ? user.pw_hash : DUMMY_HASH);
  if (!user || !ok) {
    // The same answer whether the email exists or not, so nobody can probe which emails have accounts.
    const [, left] = await Promise.all([bump(env, ipKey, LIMITS.ip), email ? bump(env, emailKey, LIMITS.email) : LIMITS.email[0]]);
    return json({ error: 'login', left }, 401, h);
  }
  if (user.status !== 'active') return json({ error: 'disabled' }, 403, h);

  await env.KV.delete(emailKey).catch(() => {});
  const t = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(t, user.id),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(t),   // tidy up old devices
  ]);
  const token = await newSession(env, req, user.id, b.remember !== false);
  return json({ token, user: publicUser(user) }, 200, h);
}

async function findReset(env, token) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const link = await env.DB.prepare('SELECT id, user_id, used_at, expires_at FROM reset_links WHERE id = ?')
    .bind(await sha256(token)).first();
  if (!link || link.used_at || link.expires_at <= now()) return null;
  const user = await env.DB.prepare('SELECT email, status FROM users WHERE id = ?').bind(link.user_id).first();
  return user ? { ...link, ...user } : null;
}

async function resetCheck(url, env, h) {
  const row = await findReset(env, url.searchParams.get('token') || '');
  return row && row.status === 'active' ? json({ email: row.email }, 200, h) : json({ error: 'reset_invalid' }, 404, h);
}

async function resetPassword(req, env, h) {
  const ipKey = 'rl:rs:' + clientIp(req);
  if (await tooMany(env, ipKey, LIMITS.reset)) return json({ error: 'rate' }, 429, h);
  await bump(env, ipKey, LIMITS.reset);
  const b = await readJson(req);
  const row = await findReset(env, String(b.token || ''));
  if (!row || row.status !== 'active') return json({ error: 'reset_invalid' }, 404, h);
  const password = cleanPassword(b.password);
  const problem = await passwordProblem(password, row.email);
  if (problem) return json({ error: problem }, 400, h);

  const t = now();
  const used = await env.DB.prepare('UPDATE reset_links SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(t, row.id).run();
  if (used.meta.changes !== 1) return json({ error: 'reset_invalid' }, 404, h);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET pw_hash = ?, last_login_at = ? WHERE id = ?').bind(await hashPassword(password), t, row.user_id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id),   // sign out every old device
  ]);
  await env.KV.delete('lk:em:' + await sha256(row.email)).catch(() => {});
  const token = await newSession(env, req, row.user_id, true);
  const user = await env.DB.prepare('SELECT email, role FROM users WHERE id = ?').bind(row.user_id).first();
  return json({ token, user: publicUser(user) }, 200, h);
}

/* ---------- my account ---------- */

async function me(env, s, h) {
  const r = await env.DB.prepare(
    'SELECT id, device, country, created_at, last_seen_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen_at DESC')
    .bind(s.id, now()).all();
  return json({ email: s.email, role: s.role, created_at: s.created_at, current: s.sid, sessions: r.results }, 200, h);
}

async function checkOwnPassword(env, req, s, password, h) {
  const emailKey = 'lk:em:' + await sha256(s.email);
  if (await tooMany(env, emailKey, LIMITS.email)) return json({ error: 'locked' }, 429, h);
  const row = await env.DB.prepare('SELECT pw_hash FROM users WHERE id = ?').bind(s.id).first();
  if (await verifyPassword(password, row.pw_hash)) return null;
  await bump(env, emailKey, LIMITS.email);
  return json({ error: 'pw_wrong' }, 403, h);
}

async function changePassword(req, env, s, h) {
  const b = await readJson(req);
  const denied = await checkOwnPassword(env, req, s, cleanPassword(b.current), h);
  if (denied) return denied;
  const next = cleanPassword(b.next);
  const problem = await passwordProblem(next, s.email);
  if (problem) return json({ error: problem }, 400, h);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').bind(await hashPassword(next), s.id),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(s.id, s.sid),   // other devices sign in again
  ]);
  return json({ ok: true }, 200, h);
}

async function deleteAccount(req, env, s, h) {
  const b = await readJson(req);
  const denied = await checkOwnPassword(env, req, s, cleanPassword(b.password), h);
  if (denied) return denied;
  if (s.role === 'owner') {
    const owners = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND status = 'active'").first();
    if (owners.n <= 1) return json({ error: 'last_owner' }, 409, h);
  }
  await removeUser(env, s.id);
  return json({ ok: true }, 200, h);
}

function removeUser(env, uid) {
  return env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM reset_links WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM saved_searches WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM alerts WHERE user_id = ?').bind(uid),
    env.DB.prepare('DELETE FROM usage WHERE user_id = ?').bind(uid),
    ...FEATURES.flatMap(f => (f.onDeleteUser ? [].concat(f.onDeleteUser(env, uid)) : [])),   // each feature's own rows
    env.DB.prepare('UPDATE invites SET used_by = NULL WHERE used_by = ?').bind(uid),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(uid),
  ]);
}

/* ---------- owner tools ---------- */

function inviteCode() {
  const s = [...crypto.getRandomValues(new Uint8Array(10))].map(x => INVITE_ALPHABET[x % 32]).join('');   // 256 is a multiple of 32, so no bias
  return s.slice(0, 5) + '-' + s.slice(5);
}

async function admin(req, env, s, url, h, ctx) {
  const p = url.pathname, m = req.method;
  let mm;
  if (p === '/admin/users' && m === 'GET') {
    const r = await env.DB.prepare(
      'SELECT u.id, u.email, u.role, u.status, u.created_at, u.last_login_at, u.daily_limit, u.alerts_ok, u.mail_verified_at, ' +
      '(SELECT COUNT(*) FROM sessions x WHERE x.user_id = u.id AND x.expires_at > ?) AS devices, ' +
      "(SELECT COUNT(*) FROM alerts a WHERE a.user_id = u.id AND a.status != 'ended') AS alerts, " +
      '(SELECT calls FROM usage g WHERE g.user_id = u.id AND g.day = ?) AS used_today FROM users u ORDER BY u.created_at')
      .bind(now(), utcDay()).all();
    // limit: the cap that applies today (null = none, the owner)
    return json({ me: s.id, users: r.results.map(u => ({ ...u, used_today: u.used_today || 0, limit: limitOf(u) })), default_limit: USER_DAILY, reserve: OWNER_RESERVE }, 200, h);
  }
  if ((mm = /^\/admin\/users\/(\d+)\/alerts$/.exec(p)) && m === 'POST') {
    // the switch for an invited account's alerts (the owner's are always on); off = its alerts are skipped
    const ok = (await readJson(req)).ok;
    if (typeof ok !== 'boolean') return json({ error: 'param' }, 400, h);
    const r = await env.DB.prepare("UPDATE users SET alerts_ok = ? WHERE id = ? AND role != 'owner'").bind(ok ? 1 : 0, Number(mm[1])).run();
    return r.meta.changes ? json({ ok: true }, 200, h) : json({ error: 'not_found' }, 404, h);
  }
  if (p === '/admin/alerts' && m === 'GET') {
    const r = await env.DB.prepare('SELECT a.id, a.o, a.d, a.s, a.e, a.cabin, a.max_miles, a.status, a.checked_at, a.check_note, a.found, a.sent_at, a.sent_count, u.email ' +
      'FROM alerts a JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 200').all();
    return json({ alerts: r.results }, 200, h);
  }
  if (p === '/admin/alerts/run' && m === 'POST') {
    // run the cron's work once now (staging has no cron); answers what it checked
    return json({ ran: await runAlerts(env, ctx) }, 200, h);
  }
  if (p === '/admin/invites' && m === 'GET') {
    const r = await env.DB.prepare(
      'SELECT i.id, i.code_enc, i.label, i.role, i.created_at, i.expires_at, i.used_at, u.email AS used_by ' +
      'FROM invites i LEFT JOIN users u ON u.id = i.used_by ORDER BY i.created_at DESC LIMIT 50').all();
    const invites = await Promise.all(r.results.map(async ({ code_enc, ...i }) => ({ ...i, code: await openCode(env, i.id, code_enc) })));
    return json({ invites, days: INVITE_DAYS }, 200, h);
  }
  if (p === '/admin/invites' && m === 'POST') {
    const b = await readJson(req);
    const code = inviteCode(), t = now(), expires = t + INVITE_DAYS * 86400;
    const id = await sha256(code.replace('-', ''));
    await env.DB.prepare('INSERT INTO invites (id, code_enc, label, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, await sealCode(env, id, code), String(b.label || '').trim().slice(0, 40) || null, 'user', s.id, t, expires).run();
    return json({ code, expires_at: expires }, 201, h);
  }
  if ((mm = /^\/admin\/invites\/([A-Za-z0-9_-]{43})$/.exec(p)) && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM invites WHERE id = ? AND used_at IS NULL').bind(mm[1]).run();
    return json({ ok: true }, 200, h);
  }
  if ((mm = /^\/admin\/users\/(\d+)\/limit$/.exec(p)) && m === 'POST') {
    // an account's daily call cap: a whole number from 0 to 1000, or null for the default
    const v = (await readJson(req)).limit;
    if (v !== null && !(Number.isInteger(v) && v >= 0 && v <= 1000)) return json({ error: 'param' }, 400, h);
    const r = await env.DB.prepare("UPDATE users SET daily_limit = ? WHERE id = ? AND role != 'owner'").bind(v, Number(mm[1])).run();
    return r.meta.changes ? json({ ok: true }, 200, h) : json({ error: 'not_found' }, 404, h);
  }
  if ((mm = /^\/admin\/users\/(\d+)(\/status|\/reset-link)?$/.exec(p))) {
    const uid = Number(mm[1]);
    const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(uid).first();
    if (!user) return json({ error: 'not_found' }, 404, h);
    if (mm[2] === '/reset-link' && m === 'POST') {
      const token = randomToken(32), t = now(), expires = t + RESET_MINUTES * 60;
      await env.DB.prepare('INSERT INTO reset_links (id, user_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
        .bind(await sha256(token), uid, s.id, t, expires).run();
      return json({ url: env.SITE_URL + '#reset=' + token, expires_at: expires }, 201, h);
    }
    if (uid === s.id) return json({ error: 'self' }, 400, h);
    if (mm[2] === '/status' && m === 'POST') {
      const status = (await readJson(req)).status === 'disabled' ? 'disabled' : 'active';
      await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, uid).run();
      if (status === 'disabled') await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(uid).run();
      return json({ ok: true }, 200, h);
    }
    if (!mm[2] && m === 'DELETE') {
      await removeUser(env, uid);
      return json({ ok: true }, 200, h);
    }
  }
  return json({ error: 'not_found' }, 404, h);
}

/* ---------- seats.aero relay ---------- */

/* ---------- daily call budget per account ---------- */
// Every account searches with the owner's key and its 1,000 calls per UTC day, so invited accounts get their own
// smaller budget, and stop early when the key is nearly used up, keeping the rest for the owner.
const USER_DAILY = 200;       // calls per UTC day for an invited account (users.daily_limit overrides it)
const OWNER_RESERVE = 300;    // invited accounts stop when the key has this many calls or fewer left today
const utcDay = () => new Date().toISOString().slice(0, 10);
const limitOf = s => (s.role === 'owner' ? null : s.daily_limit ?? USER_DAILY);
async function usedToday(env, uid) {
  const r = await env.DB.prepare('SELECT calls FROM usage WHERE user_id = ? AND day = ?').bind(uid, utcDay()).first();
  return r ? r.calls : 0;
}
// null when the call may go ahead, otherwise the refusal to send back
async function budgetCheck(env, s, h, cost = 1) {
  if (s.role === 'owner') return null;
  const lim = limitOf(s), used = await usedToday(env, s.id);
  if (used + cost > lim) return json({ error: 'user_quota', used, limit: lim }, 429, h);
  const q = await env.DB.prepare('SELECT remaining, at FROM quota WHERE id = 1').first();
  const midnight = Math.floor(Date.parse(utcDay() + 'T00:00:00Z') / 1000);
  if (q && q.at >= midnight && q.remaining - cost < OWNER_RESERVE) return json({ error: 'reserve' }, 429, h);
  return null;
}
// count n real calls (negative for a refund) against the account; runs after the response is sent
function spend(env, ctx, s, n) {
  if (!n) return;
  ctx.waitUntil(env.DB.prepare('INSERT INTO usage (user_id, day, calls) VALUES (?, ?, ?) ON CONFLICT(user_id, day) DO UPDATE SET calls = MAX(0, calls + excluded.calls)')
    .bind(s.id, utcDay(), n).run().catch(e => console.error('usage', e)));
}

// headers for the page: CORS, no caching, and seats.aero's rate-limit numbers; also keeps the key's latest
// remaining count in D1 (not KV: its free plan allows 1,000 writes a day, the same as the call quota)
function passOn(r, env, h, ctx) {
  const out = new Headers(h);
  out.set('Content-Type', r.headers.get('Content-Type') || 'application/json');
  out.set('Cache-Control', 'no-store');
  for (const [k, v] of r.headers) if (k.toLowerCase().startsWith('x-ratelimit')) out.set(k, v);
  const left = parseInt(r.headers.get('X-RateLimit-Remaining'), 10);
  if (Number.isFinite(left)) {
    const lim = parseInt(r.headers.get('X-RateLimit-Limit'), 10);
    ctx.waitUntil(env.DB.prepare('INSERT INTO quota (id, remaining, quota_limit, at) VALUES (1, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET remaining = excluded.remaining, quota_limit = excluded.quota_limit, at = excluded.at')
      .bind(left, Number.isFinite(lim) ? lim : null, now()).run().catch(e => console.error('quota', e)));
  }
  return out;
}

async function relay(path, env, h, ctx, s) {
  const stop = await budgetCheck(env, s, h);
  if (stop) return stop;
  const r = await fetch(UPSTREAM + path, {
    headers: { 'Partner-Authorization': env.SEATS_KEY, accept: 'application/json', 'User-Agent': 'award-search (personal use)' },
  });
  spend(env, ctx, s, 1);
  return new Response(r.body, { status: r.status, headers: passOn(r, env, h, ctx) });
}

// 即時核對: ask seats.aero to re-check up to 3 cached rows. Queueing a stale row costs 1 call; sending the same
// IDs again is how you poll and costs nothing; a failed row is refunded. The answer holds statuses only, so the
// page re-reads the row afterwards. Only what seats.aero says it charged (queued minus refunded) is counted.
async function refresh(req, env, h, ctx, s) {
  const b = await readJson(req);
  const ids = [...new Set(Array.isArray(b.ids) ? b.ids : [])];
  if (!ids.length || ids.length > 3 || !ids.every(x => typeof x === 'string' && /^[A-Za-z0-9]{10,40}$/.test(x))) return json({ error: 'param' }, 400, h);
  const stop = await budgetCheck(env, s, h, b.poll ? 0 : ids.length);   // a poll queues nothing new
  if (stop) return stop;
  const r = await fetch(UPSTREAM + '/refresh', {
    method: 'POST',
    headers: { 'Partner-Authorization': env.SEATS_KEY, accept: 'application/json', 'content-type': 'application/json', 'User-Agent': 'award-search (personal use)' },
    body: JSON.stringify({ availability_ids: ids }),
  });
  const text = await r.text();
  let d = null;
  try { d = JSON.parse(text); } catch {}
  if (d && Number.isFinite(d.queued)) spend(env, ctx, s, d.queued - (d.refunded || 0));
  return new Response(text, { status: r.status, headers: passOn(r, env, h, ctx) });
}

function search(url, env, h, ctx, s) {
  const qs = new URLSearchParams();
  for (const [k, v] of url.searchParams) {
    if (!SEARCH_RULES[k] || !SEARCH_RULES[k].test(v)) return json({ error: 'param', param: k }, 400, h);
    qs.set(k, v);
  }
  if (!qs.has('origin_airport') || !qs.has('destination_airport')) return json({ error: 'param' }, 400, h);
  return relay('/search?' + qs, env, h, ctx, s);
}

/* ---------- saved searches (收藏) ---------- */
// A saved search is the search form as JSON, plus "seen": the lowest miles per leg, cabin, date and program from
// the last look, so the page can mark awards that are new or cheaper since then. Private to each account.
const SAVED_MAX = 20;
const SEEN_MAX_BYTES = 400000;   // a 3-month round trip is about 100 KB
const AIRPORTS = /^[A-Z]{3}(,[A-Z]{3}){0,19}$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
function cleanSearch(p) {
  if (!p || typeof p !== 'object' || !AIRPORTS.test(p.o) || !AIRPORTS.test(p.d) || !DAY.test(p.s) || !DAY.test(p.e)) return null;
  const out = { o: p.o, d: p.d, s: p.s, e: p.e };
  if (p.rt) {
    if (!DAY.test(p.rt.s) || !DAY.test(p.rt.e)) return null;
    out.rt = { s: p.rt.s, e: p.rt.e };
  }
  // 多城市: up to three more one-way legs, each with its own airports and range
  if (p.mc != null) {
    if (!Array.isArray(p.mc) || !p.mc.length || p.mc.length > 3 || p.rt) return null;
    out.mc = [];
    for (const L of p.mc) {
      if (!L || !AIRPORTS.test(L.o) || !AIRPORTS.test(L.d) || !DAY.test(L.s) || !DAY.test(L.e)) return null;
      out.mc.push({ o: L.o, d: L.d, s: L.s, e: L.e });
    }
  }
  if (p.mixed) out.mixed = 1;
  if (p.dyn) out.dyn = 1;
  return out;
}
// seen arrives as an object of key -> miles; anything outside that shape is refused, and it is stored as a string
function cleanSeen(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  for (const [k, n] of Object.entries(v)) {
    if (!/^[0-3][YWJF]\d{4}-\d{2}-\d{2}[a-z0-9]{2,20}$/.test(k) || !Number.isFinite(n) || n < 0 || n > 1e7) return null;
    out[k] = Math.round(n);
  }
  const s = JSON.stringify(out);
  return s.length <= SEEN_MAX_BYTES ? s : null;
}
async function readBig(req, max) {
  const text = await req.text();
  if (text.length > max) return {};
  try { const v = JSON.parse(text || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
async function saved(req, env, s, p, m, h) {
  let mm;
  if (p === '/me/saved' && m === 'GET') {
    const r = await env.DB.prepare('SELECT id, params, label, created_at, seen_at FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC').bind(s.id).all();
    return json({ saved: r.results.map(x => ({ ...x, params: JSON.parse(x.params) })), max: SAVED_MAX }, 200, h);
  }
  if (p === '/me/saved' && m === 'POST') {
    const b = await readBig(req, SEEN_MAX_BYTES + 5000);
    const params = cleanSearch(b.params);
    if (!params) return json({ error: 'param' }, 400, h);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM saved_searches WHERE user_id = ?').bind(s.id).first();
    if (n.n >= SAVED_MAX) return json({ error: 'too_many' }, 400, h);
    const seen = b.seen ? cleanSeen(b.seen) : null, t = now();
    const ins = await env.DB.prepare('INSERT INTO saved_searches (user_id, params, label, created_at, seen_at, seen) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(s.id, JSON.stringify(params), String(b.label || '').trim().slice(0, 40) || null, t, seen ? t : null, seen).run();
    return json({ id: ins.meta.last_row_id }, 201, h);
  }
  if ((mm = /^\/me\/saved\/(\d{1,12})$/.exec(p)) && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM saved_searches WHERE id = ? AND user_id = ?').bind(+mm[1], s.id).run();
    return json({ ok: true }, 200, h);
  }
  if ((mm = /^\/me\/saved\/(\d{1,12})\/seen$/.exec(p)) && m === 'GET') {
    const r = await env.DB.prepare('SELECT seen, seen_at FROM saved_searches WHERE id = ? AND user_id = ?').bind(+mm[1], s.id).first();
    if (!r) return json({ error: 'not_found' }, 404, h);
    return json({ seen: r.seen ? JSON.parse(r.seen) : null, seen_at: r.seen_at }, 200, h);
  }
  if ((mm = /^\/me\/saved\/(\d{1,12})\/seen$/.exec(p)) && m === 'PUT') {
    const seen = cleanSeen((await readBig(req, SEEN_MAX_BYTES + 1000)).seen);
    if (!seen) return json({ error: 'param' }, 400, h);
    const r = await env.DB.prepare('UPDATE saved_searches SET seen = ?, seen_at = ? WHERE id = ? AND user_id = ?').bind(seen, now(), +mm[1], s.id).run();
    return r.meta.changes ? json({ ok: true }, 200, h) : json({ error: 'not_found' }, 404, h);
  }
  return null;
}

/* ---------- email alerts (提醒) ---------- */
// Gino 2026-10-14: an alert is a fixed search (route, dates, cabin, programs) with a miles ceiling. About every
// 3 hours the Worker re-runs it and emails the account when an award at or under the ceiling is new, or cheaper
// than what was last emailed; the first email lists what is there already. The cron runs every 10 minutes and
// checks only the most overdue alert, so one run parses one seats.aero reply (the free plan allows 10 ms CPU a
// run). A check is one seats.aero call, counted against the account like a search, so an invited account's
// alerts stop at its daily cap or the owner's reserve. Mail goes out through Cloudflare Email Routing, which
// delivers only to addresses that clicked Cloudflare's verification email: an account verifies its sign-in email
// once (/me/mail), and its alerts are checked only after that.
const ALERTS_MAX = 10;          // per account; paused ones count, ended ones don't
const ALERT_EVERY = 3 * 3600;   // seconds between two checks of one alert
const ALERTS_PER_RUN = 1;
const ALERT_DAYS_MAX = 92;      // the longest date range
const SENT_KEYS_MAX = 3000;
const CABIN_API = { Y: 'economy', W: 'premium', J: 'business', F: 'first' };
// the names the page shows (its PROGRAMS table)
const PROGRAM_NAME = {
  united: 'United', aeroplan: 'Aeroplan', turkish: 'Turkish', singapore: 'KrisFlyer', lufthansa: 'Miles & More',
  connectmiles: 'ConnectMiles', ethiopian: 'ShebaMiles', lifemiles: 'LifeMiles', american: 'American', alaska: 'Alaska',
  qantas: 'Qantas', qatar: 'Qatar', finnair: 'Finnair', british: 'British Airways', iberia: 'Iberia', delta: 'Delta',
  flyingblue: 'Flying Blue', virginatlantic: 'Virgin Atlantic', aeromexico: 'Aeromexico', eurobonus: 'EuroBonus',
  saudia: 'Saudia', emirates: 'Emirates', etihad: 'Etihad', velocity: 'Velocity', jetblue: 'JetBlue', azul: 'Azul',
  smiles: 'Smiles', frontier: 'Frontier', spirit: 'Spirit',
};
const NO_TAX = new Set(['qatar', 'turkish', 'singapore']);   // seats.aero has no tax data for these
const MAIL_WORDS = {
  zh: {
    from: '里程機位搜尋', cabin: { Y: '經濟艙', W: '豪華經濟艙', J: '商務艙', F: '頭等艙' }, wd: '日一二三四五六',
    subject: (route, cab, n, min) => `✈️ ${route} ${cab}：${n} 筆新的位子，最低 ${min} 哩`,
    intro: (name, cab, max, n) => `你設的提醒「${name}」找到 ${n} 筆新的或更便宜的位子（${cab}，${max} 哩以下）：`,
    day: (md, w) => `${md}（${w}）`, miles: x => `${x} 哩`, seats: n => `剩 ${n} 位`, direct: '直飛', was: x => `降價，原本 ${x} 哩`,
    more: n => `另外還有 ${n} 筆，到網站看。`, open: '打開網站看全部結果', manage: '暫停或刪除這個提醒',
    rtSubject: (route, cab, n, min) => `✈️ ${route} ${cab}來回：${n} 組新的日期，最低合計 ${min} 哩`,
    rtIntro: (name, cab, max, n) => `你設的來回提醒「${name}」找到 ${n} 組新的或更便宜的日期組合（${cab}，來回合計 ${max} 哩以下）：`,
    out: '去', back: '回', total: x => `合計 ${x} 哩`, moreRt: n => `另外還有 ${n} 組，到網站看。`,
    note: '資料是 seats.aero 的快取，可能是幾小時前的。訂位前請到航空公司網站確認。',
  },
  en: {
    from: 'Award Search', cabin: { Y: 'economy', W: 'premium economy', J: 'business', F: 'first' }, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    subject: (route, cab, n, min) => `✈️ ${route} ${cab}: ${n} new award${n === 1 ? '' : 's'} from ${min} miles`,
    intro: (name, cab, max, n) => `Your alert "${name}" found ${n} new or cheaper award${n === 1 ? '' : 's'} (${cab}, up to ${max} miles):`,
    day: (md, w) => `${w} ${md}`, miles: x => `${x} miles`, seats: n => `${n} seat${n === 1 ? '' : 's'} left`, direct: 'nonstop', was: x => `was ${x}`,
    more: n => `${n} more on the site.`, open: 'See all results on the site', manage: 'Pause or delete this alert',
    rtSubject: (route, cab, n, min) => `✈️ ${route} ${cab} round trip: ${n} new date pair${n === 1 ? '' : 's'} from ${min} miles in total`,
    rtIntro: (name, cab, max, n) => `Your round-trip alert "${name}" found ${n} new or cheaper date pair${n === 1 ? '' : 's'} (${cab}, up to ${max} miles in total):`,
    out: 'Out', back: 'Back', total: x => `${x} miles in total`, moreRt: n => `${n} more pairs on the site.`,
    note: "From seats.aero's cache, which can be a few hours old. Check with the airline before you book.",
  },
};
const num = v => (typeof v === 'number' ? v : parseInt(v, 10)) || 0;
const fmtN = n => Number(n).toLocaleString('en-US');
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const escHtml = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const routeText = a => a.o.split(',').join('/') + (a.rs ? ' ⇄ ' : ' → ') + a.d.split(',').join('/');

function cleanAlert(b) {
  const today = utcDay();
  const o = String(b.o || '').toUpperCase(), d = String(b.d || '').toUpperCase();
  if (!AIRPORTS.test(o) || !AIRPORTS.test(d) || !DAY.test(b.s) || !DAY.test(b.e)) return null;
  if (b.e < b.s || b.e < today || daysBetween(b.s, b.e) > ALERT_DAYS_MAX || daysBetween(today, b.s) > 400) return null;
  if (!CABIN_API[b.cabin]) return null;
  let sources = null;
  if (Array.isArray(b.sources) && b.sources.length) {
    if (b.sources.length > 40 || !b.sources.every(x => typeof x === 'string' && /^[a-z0-9]{2,20}$/.test(x))) return null;
    sources = [...new Set(b.sources)].join(',');
  }
  const seats = b.seats == null ? 1 : b.seats;
  if (!Number.isInteger(b.max_miles) || b.max_miles < 1000 || b.max_miles > 4000000 || !Number.isInteger(seats) || seats < 1 || seats > 9) return null;
  // 來回: a return range, starting no earlier than the outbound one; max_miles is then the total of both directions
  let rs = null, re = null;
  if (b.rs != null || b.re != null) {
    if (!DAY.test(b.rs) || !DAY.test(b.re) || b.re < b.rs || b.re < today || b.rs < b.s || daysBetween(b.rs, b.re) > ALERT_DAYS_MAX || daysBetween(today, b.rs) > 400) return null;
    rs = b.rs; re = b.re;
  } else if (b.max_miles > 2000000) return null;
  return { o, d, s: b.s, e: b.e, rs, re, cabin: b.cabin, sources, max_miles: b.max_miles, direct: b.direct ? 1 : 0, seats,
    label: String(b.label || '').trim().slice(0, 40) || null, lang: b.lang === 'en' ? 'en' : 'zh' };
}
const alertOut = a => ({
  id: a.id, o: a.o, d: a.d, s: a.s, e: a.e, rs: a.rs || null, re: a.re || null, cabin: a.cabin, sources: a.sources ? a.sources.split(',') : null, max_miles: a.max_miles,
  direct: !!a.direct, seats: a.seats, label: a.label, lang: a.lang, status: a.status, created_at: a.created_at,
  checked_at: a.checked_at, check_note: a.check_note, found: a.found, sent_at: a.sent_at, sent_count: a.sent_count,
});

// the awards in one seats.aero reply that meet an alert, read the way the page reads a card (offersOf)
function alertHits(rows, a, from) {
  const C = a.cabin, srcs = a.sources ? new Set(a.sources.split(',')) : null, out = [];
  for (const r of rows) {
    if (!r[C + 'Available'] || r.Date < from || r.Date > a.e) continue;
    const src = r.Source || (r.Route && r.Route.Source);
    if (srcs && !srcs.has(src)) continue;
    const direct = !!r[C + 'Direct'];
    if (a.direct && !direct) continue;
    const dmiles = num(r[C + 'DirectMileageCost']), useD = a.direct && dmiles > 0;
    const miles = useD ? dmiles : num(r[C + 'MileageCost']);
    if (!miles || miles > a.max_miles) continue;
    const pick = k => (useD && r[C + 'Direct' + k] != null ? r[C + 'Direct' + k] : r[C + k]);
    const seats = num(pick('RemainingSeats'));
    if (a.seats > 1 && seats && seats < a.seats) continue;   // 0: the program gives no count, kept as the page does
    const from_ = r.Route ? r.Route.OriginAirport : '', to = r.Route ? r.Route.DestinationAirport : '';
    out.push({ k: r.Date + src + from_ + to, date: r.Date, src, from: from_, to, miles, seats, direct, tax: num(pick('TotalTaxes')), cur: r.TaxesCurrency || '',
      air: String(pick('Airlines') || '').split(/[\s,]+/).filter(Boolean).slice(0, 4).join(', ') });
  }
  return out.sort((x, y) => x.miles - y.miles || (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

function taxText(x) {
  if (NO_TAX.has(x.src) || !x.tax) return '';
  const v = x.tax / 100, cur = x.cur || 'USD';
  if (cur === 'TWD') return 'NT$' + fmtN(Math.round(v));
  return (cur === 'USD' ? 'US$' : cur + ' ') + (Number.isInteger(v) ? fmtN(v) : v.toFixed(2));
}

// base64 of UTF-8 text, and RFC 2047 words of at most 45 bytes so each stays under 75 characters
function b64utf8(s) {
  const bytes = enc.encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
}
function mimeWords(s) {
  const words = [];
  let cur = '';
  for (const ch of s) {
    if (cur && enc.encode(cur + ch).length > 45) { words.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) words.push(cur);
  return words.map(w => '=?UTF-8?B?' + b64utf8(w) + '?=').join('\r\n ');
}
async function sendMail(env, to, fromName, subject, text, html) {
  const from = env.MAIL_FROM || 'alerts@ginochang.com', b = 'b_' + randomToken(12);
  const part = (type, body) => ['--' + b, 'Content-Type: ' + type + '; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64utf8(body).replace(/.{76}/g, '$&\r\n')];
  const raw = [
    'From: ' + mimeWords(fromName) + ' <' + from + '>', 'To: <' + to + '>', 'Subject: ' + mimeWords(subject),
    'Date: ' + new Date().toUTCString(), 'Message-ID: <' + randomToken(18) + '@' + from.split('@')[1] + '>',
    'Auto-Submitted: auto-generated', 'MIME-Version: 1.0', 'Content-Type: multipart/alternative; boundary="' + b + '"', '',
    ...part('text/plain', text), ...part('text/html', html), '--' + b + '--', '',
  ].join('\r\n');
  await env.ALERT_MAIL.send(new EmailMessage(from, to, raw));
}

// one email for the new or cheaper awards of an alert (sent: what earlier emails said, for the "was" price)
async function sendAlertMail(env, a, fresh, sent) {
  const L = MAIL_WORDS[a.lang] || MAIL_WORDS.zh, cab = L.cabin[a.cabin], route = routeText(a);
  const site = env.SITE_URL || 'https://award.ginochang.com/';
  const many = a.o.includes(',') || a.d.includes(',');   // a multi-airport alert names each row's airports
  const shown = fresh.slice(0, 25);
  const rows = shown.map(x => {
    const day = L.day(+x.date.slice(5, 7) + '/' + +x.date.slice(8, 10), L.wd[new Date(x.date + 'T00:00:00Z').getUTCDay()]);
    const info = [taxText(x) ? '+ ' + taxText(x) : '', many ? x.from + '→' + x.to : '', x.seats ? L.seats(x.seats) : '', x.direct ? L.direct : '', x.air].filter(Boolean);
    return { day, prog: PROGRAM_NAME[x.src] || x.src, miles: L.miles(fmtN(x.miles)), info, was: x.k in sent ? L.was(fmtN(sent[x.k])) : '' };
  });
  const intro = L.intro(a.label || route, cab, fmtN(a.max_miles), fresh.length);
  const more = fresh.length > shown.length ? L.more(fresh.length - shown.length) : '';
  const openUrl = site + '#/alert/' + a.id, manageUrl = site + '#/alerts';
  const text = [intro, '', ...rows.map(r => [r.day, r.prog, r.miles, ...r.info, r.was].filter(Boolean).join('  ')), ...(more ? ['', more] : []), '',
    L.open + ': ' + openUrl, L.manage + ': ' + manageUrl, '', L.note].join('\n');
  const ink = '#3E3A39', soft = '#6B6461';
  // each award in two lines (date, program and miles; then taxes and details), so a phone keeps every line whole
  const cell = 'padding:8px 4px 0;border-top:1px dashed ' + ink + ';vertical-align:top';
  const rowHtml = r => '<tr><td style="' + cell + '"><b style="white-space:nowrap">' + escHtml(r.day) + '</b> <span style="white-space:nowrap">' + escHtml(r.prog) + '</span></td>' +
    '<td style="' + cell + ';text-align:right;white-space:nowrap"><b>' + escHtml(r.miles) + '</b></td></tr>' +
    '<tr><td colspan="2" style="padding:2px 4px 8px;color:' + soft + ';font-size:13px">' + escHtml(r.info.join(' · ')) +
    (r.was ? (r.info.length ? ' · ' : '') + '<b style="color:#A33A2A;white-space:nowrap">' + escHtml(r.was) + '</b>' : '') + '</td></tr>';
  const html = '<div style="background:#FFFCF6;padding:16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'PingFang TC\',\'Noto Sans TC\',sans-serif;color:' + ink + '">' +
    '<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:3px solid ' + ink + ';border-radius:18px;padding:18px 18px 14px">' +
    '<div style="font-size:20px;font-weight:bold;margin:0 0 6px">✈️ ' + escHtml(route) + ' ' + escHtml(cab) + '</div>' +
    '<p style="margin:0 0 10px;font-size:15px;line-height:1.5">' + escHtml(intro) + '</p>' +
    '<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.45">' +
    rows.map(rowHtml).join('') +
    '</table>' + (more ? '<p style="margin:8px 0 0;font-size:14px">' + escHtml(more) + '</p>' : '') +
    '<p style="margin:16px 0 10px"><a href="' + escHtml(openUrl) + '" style="display:inline-block;background:#F2A497;color:' + ink + ';border:3px solid ' + ink + ';border-radius:999px;padding:8px 18px;text-decoration:none;font-weight:bold">' + escHtml(L.open) + '</a></p>' +
    '<p style="margin:0;font-size:12px;line-height:1.5;color:' + soft + '">' + escHtml(L.note) + '<br><a href="' + escHtml(manageUrl) + '" style="color:' + ink + '">' + escHtml(L.manage) + '</a></p>' +
    '</div></div>';
  await sendMail(env, a.email, L.from, L.subject(route, cab, fresh.length, fmtN(fresh[0].miles)), text, html);
}

// one email for the new or cheaper date pairs of a round-trip alert
async function sendRtMail(env, a, fresh, sent) {
  const L = MAIL_WORDS[a.lang] || MAIL_WORDS.zh, cab = L.cabin[a.cabin], route = routeText(a);
  const site = env.SITE_URL || 'https://award.ginochang.com/';
  const day = x => L.day(+x.date.slice(5, 7) + '/' + +x.date.slice(8, 10), L.wd[new Date(x.date + 'T00:00:00Z').getUTCDay()]);
  const side = (w, x) => w + ' ' + day(x) + ' ' + (PROGRAM_NAME[x.src] || x.src) + ' ' + L.miles(fmtN(x.miles)) + (taxText(x) ? ' + ' + taxText(x) : '') + (x.k in sent ? ' (' + L.was(fmtN(sent[x.k])) + ')' : '');
  const shown = fresh.slice(0, 15);
  const intro = L.rtIntro(a.label || route, cab, fmtN(a.max_miles), fresh.length);
  const more = fresh.length > shown.length ? L.moreRt(fresh.length - shown.length) : '';
  const openUrl = site + '#/alert/' + a.id, manageUrl = site + '#/alerts';
  const text = [intro, '', ...shown.map(p => L.total(fmtN(p.total)) + '\n  ' + side(L.out, p.x) + '\n  ' + side(L.back, p.y)), ...(more ? ['', more] : []), '',
    L.open + ': ' + openUrl, L.manage + ': ' + manageUrl, '', L.note].join('\n');
  const ink = '#3E3A39', soft = '#6B6461';
  const cell = 'padding:8px 4px 0;border-top:1px dashed ' + ink + ';vertical-align:top';
  const line = (w, x) => '<div style="color:' + soft + ';font-size:13px;padding:1px 0"><b style="color:' + ink + '">' + escHtml(w) + '</b> ' + escHtml(day(x)) + ' · ' + escHtml(PROGRAM_NAME[x.src] || x.src) + ' · ' +
    escHtml(L.miles(fmtN(x.miles))) + (taxText(x) ? ' + ' + escHtml(taxText(x)) : '') + (x.k in sent ? ' · <b style="color:#A33A2A;white-space:nowrap">' + escHtml(L.was(fmtN(sent[x.k]))) + '</b>' : '') + '</div>';
  const html = '<div style="background:#FFFCF6;padding:16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'PingFang TC\',\'Noto Sans TC\',sans-serif;color:' + ink + '">' +
    '<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:3px solid ' + ink + ';border-radius:18px;padding:18px 18px 14px">' +
    '<div style="font-size:20px;font-weight:bold;margin:0 0 6px">✈️ ' + escHtml(route) + ' ' + escHtml(cab) + '</div>' +
    '<p style="margin:0 0 10px;font-size:15px;line-height:1.5">' + escHtml(intro) + '</p>' +
    '<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.45">' +
    shown.map(p => '<tr><td style="' + cell + ';padding-bottom:8px"><b>' + escHtml(L.total(fmtN(p.total))) + '</b>' + line(L.out, p.x) + line(L.back, p.y) + '</td></tr>').join('') +
    '</table>' + (more ? '<p style="margin:8px 0 0;font-size:14px">' + escHtml(more) + '</p>' : '') +
    '<p style="margin:16px 0 10px"><a href="' + escHtml(openUrl) + '" style="display:inline-block;background:#F2A497;color:' + ink + ';border:3px solid ' + ink + ';border-radius:999px;padding:8px 18px;text-decoration:none;font-weight:bold">' + escHtml(L.open) + '</a></p>' +
    '<p style="margin:0;font-size:12px;line-height:1.5;color:' + soft + '">' + escHtml(L.note) + '<br><a href="' + escHtml(manageUrl) + '" style="color:' + ink + '">' + escHtml(L.manage) + '</a></p>' +
    '</div></div>';
  await sendMail(env, a.email, L.from, L.rtSubject(route, cab, fresh.length, fmtN(fresh[0].total)), text, html);
}

// One check of one alert: a narrow search, the awards that meet it, and an email when any are new or cheaper
// (send = false only for an address not verified yet). a = an alerts row plus the account's email, role, daily_limit.
async function checkAlert(env, ctx, a, send) {
  const s = { id: a.user_id, role: a.role, daily_limit: a.daily_limit }, t = now(), today = utcDay();
  const from = a.s > today ? a.s : today;
  const stopAt = async why => {
    await env.DB.prepare('UPDATE alerts SET checked_at = ?, check_note = ? WHERE id = ?').bind(t, why, a.id).run();
    return { id: a.id, note: why };
  };
  const stop = await budgetCheck(env, s, {}, a.rs ? 2 : 1);
  if (stop) return stopAt((await stop.json()).error);
  // one direction: cheapest first, so a reply cut at 1,000 rows (a wide alert: 92 days, several airports) keeps the
  // awards that matter; each search is 1 call charged to the account
  const leg = async (o, d, s1, e1) => {
    const qs = new URLSearchParams({ origin_airport: o, destination_airport: d, start_date: s1, end_date: e1, cabins: CABIN_API[a.cabin], take: '1000', order_by: 'lowest_mileage' });
    if (a.sources) qs.set('sources', a.sources);
    const r = await fetch(UPSTREAM + '/search?' + qs, {
      headers: { 'Partner-Authorization': env.SEATS_KEY, accept: 'application/json', 'User-Agent': 'award-search (personal use)' },
    });
    spend(env, ctx, s, 1);
    passOn(r, env, {}, ctx);   // keeps the key's remaining count, as a search does
    if (!r.ok) return { err: 'upstream_' + r.status };
    const body = await r.json();
    return { hits: alertHits(body.data || [], { ...a, e: e1 }, s1), more: !!body.hasMore };
  };
  if (a.rs) return checkRoundTrip(env, ctx, a, send, leg, stopAt, t, today, from);
  const L = await leg(a.o, a.d, from, a.e);
  if (L.err) return stopAt(L.err);
  const hits = L.hits, body = { hasMore: L.more };
  const sent = a.sent ? JSON.parse(a.sent) : {};
  const fresh = hits.filter(x => !(x.k in sent) || x.miles < sent[x.k]);
  let mailed = false;
  if (fresh.length && send) {
    try { await sendAlertMail(env, a, fresh, sent); } catch (e) { console.error('alert mail', e && e.message); return stopAt('mail_failed'); }
    mailed = true;
    await alertHit(env, ctx, a, fresh);   // push notifications and the like (features/)
    for (const x of fresh) sent[x.k] = x.miles;
  }
  const keep = Object.entries(sent).filter(([k]) => k.slice(0, 10) >= today).slice(-SENT_KEYS_MAX);   // past dates go
  await env.DB.prepare('UPDATE alerts SET checked_at = ?, check_note = ?, found = ?, sent = ?' + (mailed ? ', sent_at = ?, sent_count = sent_count + 1' : '') + ' WHERE id = ?')
    .bind(t, body.hasMore ? 'more' : null, hits.length, JSON.stringify(Object.fromEntries(keep)), ...(mailed ? [t] : []), a.id).run();
  return { id: a.id, found: hits.length, fresh: fresh.length, mailed, top: hits.slice(0, 20).map(({ k, ...x }) => x) };
}

// 來回: the cheapest award of each day in each direction, paired (return at least a day after the outbound) under
// the total ceiling; a pair is new when either of its awards is new or cheaper than what was last emailed
function rtPairs(outHits, backHits, max) {
  const best = hits => { const m = new Map(); for (const x of hits) { const y = m.get(x.date); if (!y || x.miles < y.miles) m.set(x.date, x); } return [...m.values()]; };
  const outs = best(outHits), backs = best(backHits), pairs = [];
  for (const x of outs) for (const y of backs) if (y.date > x.date && x.miles + y.miles <= max) pairs.push({ x, y, total: x.miles + y.miles });
  return pairs.sort((p, q) => p.total - q.total || (p.x.date < q.x.date ? -1 : p.x.date > q.x.date ? 1 : 0));
}
async function checkRoundTrip(env, ctx, a, send, leg, stopAt, t, today, from) {
  const rfrom = a.rs > today ? a.rs : today;
  const [L1, L2] = [await leg(a.o, a.d, from, a.e), await leg(a.d, a.o, rfrom, a.re)];
  if (L1.err || L2.err) return stopAt(L1.err || L2.err);
  const pairs = rtPairs(L1.hits, L2.hits, a.max_miles);
  const sent = a.sent ? JSON.parse(a.sent) : {};
  const isNew = x => !(x.k in sent) || x.miles < sent[x.k];
  const fresh = pairs.filter(p => isNew(p.x) || isNew(p.y));
  let mailed = false;
  if (fresh.length && send) {
    try { await sendRtMail(env, a, fresh, sent); } catch (e) { console.error('alert mail', e && e.message); return stopAt('mail_failed'); }
    mailed = true;
    await alertHit(env, ctx, a, fresh.map(p => ({ ...p.x, back: p.y, total: p.total })));
    for (const p of fresh) { sent[p.x.k] = Math.min(sent[p.x.k] ?? Infinity, p.x.miles); sent[p.y.k] = Math.min(sent[p.y.k] ?? Infinity, p.y.miles); }
  }
  const keep = Object.entries(sent).filter(([k]) => k.slice(0, 10) >= today).slice(-SENT_KEYS_MAX);
  await env.DB.prepare('UPDATE alerts SET checked_at = ?, check_note = ?, found = ?, sent = ?' + (mailed ? ', sent_at = ?, sent_count = sent_count + 1' : '') + ' WHERE id = ?')
    .bind(t, L1.more || L2.more ? 'more' : null, pairs.length, JSON.stringify(Object.fromEntries(keep)), ...(mailed ? [t] : []), a.id).run();
  const brief = x => ({ date: x.date, src: x.src, miles: x.miles, from: x.from, to: x.to });
  return { id: a.id, rt: true, found: pairs.length, fresh: fresh.length, mailed, pairs: pairs.slice(0, 20).map(p => ({ out: brief(p.x), back: brief(p.y), total: p.total })) };
}

// the cron's work: end alerts whose dates have passed, then check the most overdue one(s)
async function runAlerts(env, ctx) {
  const t = now();
  await env.DB.prepare("UPDATE alerts SET status = 'ended' WHERE status != 'ended' AND e < ?").bind(utcDay()).run();
  const due = await env.DB.prepare(
    'SELECT a.*, u.email, u.role, u.daily_limit FROM alerts a JOIN users u ON u.id = a.user_id ' +
    "WHERE a.status = 'active' AND (a.checked_at IS NULL OR a.checked_at <= ?) AND u.status = 'active' " +
    "AND u.mail_verified_at IS NOT NULL AND (u.alerts_ok = 1 OR u.role = 'owner') " +
    'ORDER BY a.checked_at IS NOT NULL, a.checked_at LIMIT ?').bind(t - ALERT_EVERY + 300, ALERTS_PER_RUN).all();
  const out = [];
  for (const a of due.results) out.push(await checkAlert(env, ctx, a, true));
  return out;
}

async function alerts(req, env, ctx, s, p, m, h) {
  let mm;
  const u = await env.DB.prepare('SELECT email, alerts_ok, mail_id, mail_verified_at, mail_asked_at FROM users WHERE id = ?').bind(s.id).first();
  const allowed = s.role === 'owner' || u.alerts_ok === 1;
  if (p === '/me/alerts' && m === 'GET') {
    const r = await env.DB.prepare('SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC').bind(s.id).all();
    return json({ alerts: r.results.map(alertOut), max: ALERTS_MAX, every: ALERT_EVERY, allowed, mail: mailInfo(env, u) }, 200, h);
  }
  if (!allowed) return json({ error: 'alerts_off' }, 403, h);
  if (p === '/me/alerts' && m === 'POST') {
    const a = cleanAlert(await readJson(req));
    if (!a) return json({ error: 'param' }, 400, h);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM alerts WHERE user_id = ? AND status != 'ended'").bind(s.id).first();
    if (n.n >= ALERTS_MAX) return json({ error: 'too_many', max: ALERTS_MAX }, 400, h);
    const ins = await env.DB.prepare('INSERT INTO alerts (user_id, o, d, s, e, rs, re, cabin, sources, max_miles, direct, seats, label, lang, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(s.id, a.o, a.d, a.s, a.e, a.rs, a.re, a.cabin, a.sources, a.max_miles, a.direct, a.seats, a.label, a.lang, now()).run();
    return json({ id: ins.meta.last_row_id }, 201, h);
  }
  if ((mm = /^\/me\/alerts\/(\d{1,12})$/.exec(p)) && m === 'PUT') {
    // pause or resume, a new miles ceiling, or the email's language
    const b = await readJson(req), sets = [], vals = [];
    if (b.status !== undefined) {
      if (b.status !== 'active' && b.status !== 'paused') return json({ error: 'param' }, 400, h);
      sets.push('status = ?'); vals.push(b.status);
    }
    if (b.max_miles !== undefined) {
      if (!Number.isInteger(b.max_miles) || b.max_miles < 1000 || b.max_miles > 4000000) return json({ error: 'param' }, 400, h);
      sets.push('max_miles = ?'); vals.push(b.max_miles);
    }
    if (b.lang !== undefined) { sets.push('lang = ?'); vals.push(b.lang === 'en' ? 'en' : 'zh'); }
    if (!sets.length) return json({ error: 'param' }, 400, h);
    const r = await env.DB.prepare('UPDATE alerts SET ' + sets.join(', ') + " WHERE id = ? AND user_id = ? AND status != 'ended'").bind(...vals, +mm[1], s.id).run();
    return r.meta.changes ? json({ ok: true }, 200, h) : json({ error: 'not_found' }, 404, h);
  }
  if ((mm = /^\/me\/alerts\/(\d{1,12})$/.exec(p)) && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM alerts WHERE id = ? AND user_id = ?').bind(+mm[1], s.id).run();
    return json({ ok: true }, 200, h);
  }
  if ((mm = /^\/me\/alerts\/(\d{1,12})\/run$/.exec(p)) && m === 'POST') {
    // 立即檢查: the cron's check, now; it emails only once the address is verified; at most every 2 minutes
    const a = await env.DB.prepare('SELECT * FROM alerts WHERE id = ? AND user_id = ?').bind(+mm[1], s.id).first();
    if (!a) return json({ error: 'not_found' }, 404, h);
    if (a.status === 'ended') return json({ error: 'ended' }, 400, h);
    if (a.checked_at && now() - a.checked_at < 120) return json({ error: 'too_soon' }, 429, h);
    return json(await checkAlert(env, ctx, { ...a, email: u.email, role: s.role, daily_limit: s.daily_limit }, !!u.mail_verified_at), 200, h);
  }
  return null;
}

/* ---------- the account's email as an alert recipient ---------- */
// Cloudflare Email Routing destination addresses, through its API (CF_API_TOKEN: Email Routing Addresses: Edit).
// Adding an address makes Cloudflare send it a verification email; after its link is clicked, alert mail can
// reach it. A person needs no Cloudflare account for this, only that click.
const CF_API = 'https://api.cloudflare.com/client/v4';
async function cfAddr(env, method, path, body) {
  try {
    const r = await fetch(CF_API + '/accounts/' + env.CF_ACCOUNT + '/email/routing/addresses' + path, {
      method, headers: { Authorization: 'Bearer ' + env.CF_API_TOKEN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => null);
    return { ok: !!(r.ok && d && d.success), status: r.status, result: d ? d.result : null };
  } catch {
    return { ok: false, status: 0, result: null };
  }
}
async function findAddr(env, email) {
  for (let page = 1; page <= 5; page++) {
    const r = await cfAddr(env, 'GET', '?per_page=50&page=' + page);
    if (!r.ok || !Array.isArray(r.result)) return null;
    const hit = r.result.find(x => String(x.email).toLowerCase() === email);
    if (hit || r.result.length < 50) return hit || null;
  }
  return null;
}
const mailInfo = (env, u) => ({ email: u.email, state: u.mail_verified_at ? 'verified' : u.mail_id ? 'pending' : 'none', asked_at: u.mail_asked_at || null, ready: !!env.CF_API_TOKEN });
const mailRow = (env, s) => env.DB.prepare('SELECT email, mail_id, mail_verified_at, mail_asked_at FROM users WHERE id = ?').bind(s.id).first();

// GET /me/mail: the address's state; while it waits for its click, ask Cloudflare whether it has been clicked
async function mailCheck(env, s, h) {
  const u = await mailRow(env, s);
  if (u.mail_id && !u.mail_verified_at && env.CF_API_TOKEN) {
    const r = await cfAddr(env, 'GET', '/' + u.mail_id);
    if (r.ok && r.result && r.result.verified) {
      u.mail_verified_at = now();
      await env.DB.prepare('UPDATE users SET mail_verified_at = ? WHERE id = ?').bind(u.mail_verified_at, s.id).run();
    } else if (r.status === 404) {   // removed on Cloudflare's side
      u.mail_id = null;
      await env.DB.prepare('UPDATE users SET mail_id = NULL WHERE id = ?').bind(s.id).run();
    }
  }
  return json(mailInfo(env, u), 200, h);
}

// POST /me/mail: have Cloudflare send its verification email to the sign-in address (3 an hour). An address
// already verified there (Gino's forwarding address, say) is only recorded. One still waiting for its click is
// removed and added again, which sends a fresh email; an unverified address receives nothing, so nothing is lost.
async function mailVerify(env, s, h) {
  if (!env.CF_API_TOKEN || !env.CF_ACCOUNT) return json({ error: 'mail_off' }, 503, h);
  let u = await mailRow(env, s);
  if (u.mail_verified_at) return json(mailInfo(env, u), 200, h);
  const key = 'rl:mail:' + s.id;
  if (await tooMany(env, key, LIMITS.mail)) return json({ error: 'rate' }, 429, h);
  await bump(env, key, LIMITS.mail);
  let r = await cfAddr(env, 'POST', '', { email: u.email });
  if (!r.ok) {
    const found = await findAddr(env, u.email);
    if (found && found.verified) r = { ok: true, result: found };
    else if (found) {
      await cfAddr(env, 'DELETE', '/' + (found.id || found.tag));
      r = await cfAddr(env, 'POST', '', { email: u.email });
    }
  }
  if (!r.ok || !r.result) return json({ error: 'mail_cf' }, 502, h);
  const t = now();
  u = { ...u, mail_id: r.result.id || r.result.tag, mail_verified_at: r.result.verified ? t : null, mail_asked_at: t };
  await env.DB.prepare('UPDATE users SET mail_id = ?, mail_verified_at = ?, mail_asked_at = ? WHERE id = ?').bind(u.mail_id, u.mail_verified_at, t, s.id).run();
  return json(mailInfo(env, u), 200, h);
}

// The last remaining count seats.aero reported, and when. The page works out whether the UTC-midnight reset
// has passed since then. Costs no seats.aero call.
async function quota(env, s, h) {
  const q = await env.DB.prepare('SELECT remaining, quota_limit, at FROM quota WHERE id = 1').first();
  // me: this account's own calls today and its cap (null = no cap, the owner)
  const me = { used: await usedToday(env, s.id), limit: limitOf(s), reserve: s.role === 'owner' ? null : OWNER_RESERVE };
  return json(q ? { remaining: q.remaining, limit: q.quota_limit || 1000, at: q.at, me } : { remaining: null, limit: 1000, at: null, me }, 200, h);
}

/* ---------- feature modules (features/index.js) ---------- */
// The shared toolbox every feature module gets as `lib`.
const lib = {
  UPSTREAM, OWNER_RESERVE, USER_DAILY, LIMITS, AIRPORTS, DAY, CABIN_API, PROGRAM_NAME, NO_TAX,
  json, readJson, readBig, now, utcDay, daysBetween, num, fmtN, escHtml, routeText, randomToken, sha256, b64url, unb64url,
  tooMany, bump, budgetCheck, spend, passOn, usedToday, limitOf, sendMail, mailInfo,
  seatsHeaders: env => ({ 'Partner-Authorization': env.SEATS_KEY, accept: 'application/json', 'User-Agent': 'award-search (personal use)' }),
};
// the first feature route that matches, or null; auth 'public' routes are tried before the session check
async function featureRoute(phase, req, env, ctx, s, url, h) {
  const p = url.pathname, method = req.method;
  for (const f of FEATURES) for (const r of f.routes || []) {
    if (r.method !== method || (phase === 'public') !== (r.auth === 'public')) continue;
    let m = null;
    if (typeof r.path === 'string') { if (r.path !== p) continue; } else if (!(m = r.path.exec(p))) continue;
    if (r.auth === 'owner' && s.role !== 'owner') return json({ error: 'forbidden' }, 403, h);
    return await r.handler({ req, env, ctx, s, url, h, m, lib });
  }
  return null;
}
// the hourly cron's work, one feature at a time so one failure does not stop the rest
async function runHourly(env, ctx, at) {
  const out = {};
  for (const [i, f] of FEATURES.entries()) {
    if (!f.hourly) continue;
    try { out[f.name || i] = await f.hourly({ env, ctx, lib, at }); } catch (e) { console.error('hourly', f.name || i, e && e.stack || e); out[f.name || i] = 'error'; }
  }
  return out;
}
async function alertHit(env, ctx, alert, fresh) {
  for (const f of FEATURES) {
    if (!f.onAlertHit) continue;
    try { await f.onAlertHit({ env, ctx, lib, alert, fresh }); } catch (e) { console.error('onAlertHit', e && e.stack || e); }
  }
}

/* ---------- router ---------- */

export default {
  async fetch(req, env, ctx) {
    const h = corsHeaders(req, env);
    const url = new URL(req.url);
    const p = url.pathname, m = req.method;
    if (m === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    try {
      if (p === '/') return json({ ok: true }, 200, h);
      if (p === '/auth/register' && m === 'POST') return await register(req, env, h);
      if (p === '/auth/login' && m === 'POST') return await login(req, env, h);
      if (p === '/auth/reset' && m === 'GET') return await resetCheck(url, env, h);
      if (p === '/auth/reset' && m === 'POST') return await resetPassword(req, env, h);
      const pub = await featureRoute('public', req, env, ctx, null, url, h);
      if (pub) return pub;

      // everything below needs a signed-in session
      const s = await currentSession(req, env);
      if (!s) return json({ error: 'auth' }, 401, h);
      let mm;
      if (p === '/auth/logout' && m === 'POST') {
        await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(s.sid).run();
        return json({ ok: true }, 200, h);
      }
      if (p === '/me' && m === 'GET') return await me(env, s, h);
      if (p === '/me' && m === 'DELETE') return await deleteAccount(req, env, s, h);
      if (p === '/me/password' && m === 'POST') return await changePassword(req, env, s, h);
      if (p === '/me/sessions/others' && m === 'DELETE') {
        await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(s.id, s.sid).run();
        return json({ ok: true }, 200, h);
      }
      if ((mm = /^\/me\/sessions\/([A-Za-z0-9_-]{43})$/.exec(p)) && m === 'DELETE') {
        await env.DB.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').bind(mm[1], s.id).run();
        return json({ ok: true }, 200, h);
      }
      if (p === '/search' && m === 'GET') return search(url, env, h, ctx, s);
      if ((mm = /^\/trips\/([A-Za-z0-9]{10,40})$/.exec(p)) && m === 'GET') return relay('/trips/' + mm[1], env, h, ctx, s);
      if (p === '/quota' && m === 'GET') return await quota(env, s, h);
      if (p === '/refresh' && m === 'POST') return await refresh(req, env, h, ctx, s);
      if (p.startsWith('/me/saved')) { const r = await saved(req, env, s, p, m, h); if (r) return r; }
      if (p.startsWith('/me/alerts')) { const r = await alerts(req, env, ctx, s, p, m, h); if (r) return r; }
      if (p === '/me/mail' && m === 'GET') return await mailCheck(env, s, h);
      if (p === '/me/mail' && m === 'POST') return await mailVerify(env, s, h);
      const fr = await featureRoute('session', req, env, ctx, s, url, h);
      if (fr) return fr;
      if (p === '/admin/hourly/run' && m === 'POST' && s.role === 'owner') return json({ ran: await runHourly(env, ctx, now()) }, 200, h);   // staging has no cron
      if (p.startsWith('/admin/')) {
        if (s.role !== 'owner') return json({ error: 'forbidden' }, 403, h);
        return await admin(req, env, s, url, h, ctx);
      }
      return json({ error: 'not_found' }, 404, h);
    } catch (e) {
      console.error(e && e.stack || e);   // visible in `wrangler tail`; never holds a password
      return json({ error: 'server' }, 500, h);
    }
  },
  // the cron triggers (wrangler.toml): every 10 minutes the most overdue alert gets its check; at :05 every hour
  // the feature modules' hourly work (digests, release-date reminders, clean-up)
  async scheduled(event, env, ctx) {
    if (event.cron === '5 * * * *') ctx.waitUntil(runHourly(env, ctx, Math.floor(event.scheduledTime / 1000)));
    else ctx.waitUntil(runAlerts(env, ctx).catch(e => console.error('alerts', e && e.stack || e)));
  },
};
