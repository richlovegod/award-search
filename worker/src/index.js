// award-relay: keeps the seats.aero API key on Cloudflare and lets only the award-search site use it.
// Secrets (set with `wrangler secret put`): SEATS_KEY, SITE_PASSWORD, TOKEN_SECRET.
// The browser logs in once with the site password and gets a signed token; every search carries that token.

const UPSTREAM = 'https://seats.aero/partnerapi';
const TOKEN_DAYS = 365;
const IP_LIMIT = 5;      // wrong passwords allowed per IP ...
const IP_WINDOW = 900;   // ... per 15 minutes
const ALL_LIMIT = 30;    // wrong passwords allowed from everywhere per hour

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

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b + '='.repeat((4 - b.length % 4) % 4)), c => c.charCodeAt(0));
}

function hmacKey(env) {
  return crypto.subtle.importKey('raw', enc.encode(env.TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function makeToken(env) {
  const body = 'v1.' + (Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400);
  return body + '.' + b64url(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(body)));
}

async function tokenOk(req, env) {
  const m = /^Bearer (v1\.(\d+))\.([A-Za-z0-9_-]{20,})$/.exec(req.headers.get('Authorization') || '');
  if (!m || Number(m[2]) < Date.now() / 1000) return false;
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(env), unb64url(m[3]), enc.encode(m[1]));
  } catch {
    return false;
  }
}

async function samePassword(a, b) {
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(s))));
  return crypto.subtle.timingSafeEqual(x, y);
}

async function login(req, env, h) {
  const ipKey = 'fail:ip:' + (req.headers.get('CF-Connecting-IP') || 'unknown');
  const allKey = 'fail:all:' + Math.floor(Date.now() / 3600000);
  const [ipFails, allFails] = (await Promise.all([env.KV.get(ipKey), env.KV.get(allKey)])).map(Number);
  if (ipFails >= IP_LIMIT || allFails >= ALL_LIMIT) return json({ error: 'locked' }, 429, h);

  let password = '';
  try {
    password = String((await req.json()).password || '');
  } catch {}
  if (password && await samePassword(password, env.SITE_PASSWORD)) {
    if (ipFails) await env.KV.delete(ipKey).catch(() => {});
    return json({ token: await makeToken(env) }, 200, h);
  }
  await Promise.all([
    env.KV.put(ipKey, String(ipFails + 1), { expirationTtl: IP_WINDOW }),
    env.KV.put(allKey, String(allFails + 1), { expirationTtl: 3660 }),
  ]).catch(() => {});
  return json({ error: 'password', left: Math.max(0, IP_LIMIT - ipFails - 1) }, 401, h);
}

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

export default {
  async fetch(req, env) {
    const h = corsHeaders(req, env);
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/') return json({ ok: true }, 200, h);
    if (url.pathname === '/login') return req.method === 'POST' ? login(req, env, h) : json({ error: 'method' }, 405, h);
    if (req.method !== 'GET') return json({ error: 'method' }, 405, h);
    if (!(await tokenOk(req, env))) return json({ error: 'auth' }, 401, h);

    if (url.pathname === '/search') {
      const qs = new URLSearchParams();
      for (const [k, v] of url.searchParams) {
        if (!SEARCH_RULES[k] || !SEARCH_RULES[k].test(v)) return json({ error: 'param', param: k }, 400, h);
        qs.set(k, v);
      }
      if (!qs.has('origin_airport') || !qs.has('destination_airport')) return json({ error: 'param' }, 400, h);
      return relay('/search?' + qs, env, h);
    }
    const trip = /^\/trips\/([A-Za-z0-9]{10,40})$/.exec(url.pathname);
    if (trip) return relay('/trips/' + trip[1], env, h);
    return json({ error: 'not_found' }, 404, h);
  },
};
