// award-relay: accounts for the award search site, plus a relay that keeps the seats.aero key on Cloudflare.
//
// Phase 1 sign-in (no outgoing email):
//   users        one row per account; the password is kept only as a salted PBKDF2 hash
//   sessions     one row per signed-in device; the browser holds a random token, D1 holds its SHA-256
//   invites      registering needs a one-time invite code made by the owner
//   reset_links  the owner makes one-time links for anyone who forgot a password
// Every account searches with the owner's seats.aero key (SEATS_KEY), so the site is for the owner's own accounts only.
// Bindings: DB (D1 award-auth), KV (lockout counters). Secret: SEATS_KEY. Vars: ALLOWED_ORIGINS, SITE_URL.

const UPSTREAM = 'https://seats.aero/partnerapi';
const PBKDF2_ITER = 100000;        // the most Workers allows; measured 19 to 26 ms CPU per hash (2026-10-13)
const SESSION_LONG = 30 * 86400;   // "記住我"
const SESSION_SHORT = 86400;
const INVITE_DAYS = 7;
const RESET_MINUTES = 30;
// [allowed failures, window in seconds]
const LIMITS = { email: [5, 900], ip: [20, 900], register: [10, 3600], reset: [10, 3600] };
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
const clientIp = req => req.headers.get('CF-Connecting-IP') || 'local';

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Expose-Headers': 'X-RateLimit-Remaining, X-RateLimit-Limit',
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
    'SELECT s.id AS sid, s.expires_at, s.last_seen_at, u.id, u.email, u.role, u.status, u.created_at ' +
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
    env.DB.prepare('UPDATE invites SET used_by = NULL WHERE used_by = ?').bind(uid),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(uid),
  ]);
}

/* ---------- owner tools ---------- */

function inviteCode() {
  const s = [...crypto.getRandomValues(new Uint8Array(10))].map(x => INVITE_ALPHABET[x % 32]).join('');   // 256 is a multiple of 32, so no bias
  return s.slice(0, 5) + '-' + s.slice(5);
}

async function admin(req, env, s, url, h) {
  const p = url.pathname, m = req.method;
  let mm;
  if (p === '/admin/users' && m === 'GET') {
    const r = await env.DB.prepare(
      'SELECT u.id, u.email, u.role, u.status, u.created_at, u.last_login_at, ' +
      '(SELECT COUNT(*) FROM sessions x WHERE x.user_id = u.id AND x.expires_at > ?) AS devices FROM users u ORDER BY u.created_at')
      .bind(now()).all();
    return json({ me: s.id, users: r.results }, 200, h);
  }
  if (p === '/admin/invites' && m === 'GET') {
    const r = await env.DB.prepare(
      'SELECT i.id, i.label, i.role, i.created_at, i.expires_at, i.used_at, u.email AS used_by ' +
      'FROM invites i LEFT JOIN users u ON u.id = i.used_by ORDER BY i.created_at DESC LIMIT 50').all();
    return json({ invites: r.results }, 200, h);
  }
  if (p === '/admin/invites' && m === 'POST') {
    const b = await readJson(req);
    const code = inviteCode(), t = now(), expires = t + INVITE_DAYS * 86400;
    await env.DB.prepare('INSERT INTO invites (id, label, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(await sha256(code.replace('-', '')), String(b.label || '').trim().slice(0, 40) || null, 'user', s.id, t, expires).run();
    return json({ code, expires_at: expires }, 201, h);   // the only time the code is ever shown
  }
  if ((mm = /^\/admin\/invites\/([A-Za-z0-9_-]{43})$/.exec(p)) && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM invites WHERE id = ? AND used_at IS NULL').bind(mm[1]).run();
    return json({ ok: true }, 200, h);
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

async function relay(path, env, h) {
  const r = await fetch(UPSTREAM + path, {
    headers: { 'Partner-Authorization': env.SEATS_KEY, accept: 'application/json', 'User-Agent': 'award-search (personal use)' },
  });
  const out = new Headers(h);
  out.set('Content-Type', r.headers.get('Content-Type') || 'application/json');
  out.set('Cache-Control', 'no-store');
  for (const [k, v] of r.headers) if (k.toLowerCase().startsWith('x-ratelimit')) out.set(k, v);
  return new Response(r.body, { status: r.status, headers: out });
}

function search(url, env, h) {
  const qs = new URLSearchParams();
  for (const [k, v] of url.searchParams) {
    if (!SEARCH_RULES[k] || !SEARCH_RULES[k].test(v)) return json({ error: 'param', param: k }, 400, h);
    qs.set(k, v);
  }
  if (!qs.has('origin_airport') || !qs.has('destination_airport')) return json({ error: 'param' }, 400, h);
  return relay('/search?' + qs, env, h);
}

/* ---------- router ---------- */

export default {
  async fetch(req, env) {
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
      if (p === '/search' && m === 'GET') return search(url, env, h);
      if ((mm = /^\/trips\/([A-Za-z0-9]{10,40})$/.exec(p)) && m === 'GET') return relay('/trips/' + mm[1], env, h);
      if (p.startsWith('/admin/')) {
        if (s.role !== 'owner') return json({ error: 'forbidden' }, 403, h);
        return await admin(req, env, s, url, h);
      }
      return json({ error: 'not_found' }, 404, h);
    } catch (e) {
      console.error(e && e.stack || e);   // visible in `wrangler tail`; never holds a password
      return json({ error: 'server' }, 500, h);
    }
  },
};
