// 飯店 (hotel award search through rooms.aero), Gino 2026-10-15. rooms.aero is seats.aero's hotel site: it takes the
// same Pro key (SEATS_KEY) and keeps its own quota of 1,000 calls per UTC day, separate from the flights one, so it
// gets its own budget here, built like the flights one in ../index.js (budgetCheck, spend, passOn):
//   rooms_usage  calls per account per UTC day; invited accounts get ROOMS_DAILY each, the owner has no cap.
//                users.daily_limit is not used: the admin page sets it as the account's seats.aero calls only
//   rooms_quota  rooms.aero's remaining count, from the X-RateLimit-* headers of the latest call (one row)
// Invited accounts also stop when rooms.aero has ROOMS_RESERVE calls or fewer left today, keeping the rest for the owner.
// Unlike the flights budget, an invited account's call is taken from its cap in one statement before the fetch (and
// given back when rooms.aero does not count it), so searches running at the same moment cannot pass the cap.
//
// A search reply goes back as rooms.aero sent it, unparsed (a 500-hotel reply is about 700 KB, too much to parse in
// the free plan's CPU time), with rooms.aero's rate-limit headers renamed X-Rooms-RateLimit-*, so the page's flight
// meter, which reads X-RateLimit-*, is not confused. Its cookies and other headers are not passed on.
// Measured with real calls on 2026-10-15: points and cash are per night (a 2-night search gives the nightly average);
// cash is in hundredths of currency_code (TWD and JPY too); without nights the cheapest stay can be 4 or 5 nights,
// so nights is always sent (1 when the page leaves it out); a place rooms.aero can't find answers 200 with no
// hotels, and that call still counts against its 1,000. Tables: migrations/0011_hotels.sql.

export const name = 'hotels';

export const ROOMS_UPSTREAM = 'https://rooms.aero/partnerapi';
export const ROOMS_DAILY = 100;     // calls per UTC day for an invited account
export const ROOMS_RESERVE = 200;   // invited accounts stop when rooms.aero has this many calls or fewer left today
export const ROOMS_SOURCES = ['hilton', 'hyatt', 'ihg', 'marriott', 'choice', 'wyndham', 'iprefer'];
const RANGE_DAYS = 30;   // check-in dates at most this many days apart (the page's limit)
const AHEAD_DAYS = 366;  // the first check-in date at most this far ahead

// Query parameters the page may send, and the shape each must have. location is checked after tidying.
const LOCATION = /^[\p{L}\p{M}\d ,.'-]{1,60}$/u;   // letters of any language (with their accents), digits, spaces , . - '
const COORD = /^-?\d{1,3}(\.\d{1,10})?$/;
const BOX = ['sw_lat', 'sw_lng', 'ne_lat', 'ne_lng'];
const RULES = {
  start_date: /^\d{4}-\d{2}-\d{2}$/,
  end_date: /^\d{4}-\d{2}-\d{2}$/,
  nights: /^[1-5]$/,
  source: /^[a-z]{3,10}(,[a-z]{3,10}){0,6}$/,
  max_points: /^[1-9]\d{0,6}$/,
  take: /^[1-9]\d{0,2}$/,
  skip: /^(0|[1-9]\d{0,3})$/,
};
const KEYS = new Set(['location', ...BOX, ...Object.keys(RULES)]);

const dayOf = ms => new Date(ms).toISOString().slice(0, 10);
const plusDays = (day, k) => dayOf(Date.parse(day + 'T00:00:00Z') + k * 86400000);
// a real date written YYYY-MM-DD (2026-02-30 is not one)
const realDay = s => RULES.start_date.test(s) && dayOf(Date.parse(s + 'T00:00:00Z') || 0) === s;

// The page's query as the one to send rooms.aero, or { error: <the parameter that is wrong> }.
// today is the UTC date. rooms.aero's days are UTC days, so the last check-in date must be today (UTC) or later:
// a range already over there would only spend a call on a refusal. A day of slack ahead covers time zones east of
// UTC, where the page's "a year ahead" ends a day later.
export function cleanHotelQuery(params, today) {
  const seen = new Set();
  for (const k of params.keys()) {
    if (!KEYS.has(k) || seen.has(k)) return { error: k };   // unknown, or given twice
    seen.add(k);
  }
  for (const [k, re] of Object.entries(RULES)) if (params.has(k) && !re.test(params.get(k))) return { error: k };
  const qs = new URLSearchParams();
  const box = BOX.filter(k => params.has(k));
  if (box.length === 4) {
    // a complete box wins over location, as on rooms.aero itself
    const v = BOX.map(k => params.get(k));
    if (!v.every(x => COORD.test(x))) return { error: 'box' };
    const [swLat, swLng, neLat, neLng] = v.map(Number);
    if (Math.abs(swLat) > 90 || Math.abs(neLat) > 90 || Math.abs(swLng) > 180 || Math.abs(neLng) > 180 || !(neLat > swLat) || !(neLng > swLng)) return { error: 'box' };
    BOX.forEach((k, i) => qs.set(k, v[i]));
  } else if (box.length) return { error: 'box' };
  else {
    // tidy what a phone keyboard adds: the curly apostrophe, runs of spaces
    const loc = String(params.get('location') || '').normalize('NFC').replace(/’/g, "'").replace(/\s+/g, ' ').trim();
    if (!LOCATION.test(loc) || !/[\p{L}\d]/u.test(loc)) return { error: 'location' };
    qs.set('location', loc);
  }
  const s = params.get('start_date'), e = params.get('end_date');
  if (!realDay(s) || !realDay(e) || e < s || (Date.parse(e) - Date.parse(s)) / 86400000 > RANGE_DAYS) return { error: 'dates' };
  if (e < today || s > plusDays(today, AHEAD_DAYS)) return { error: 'dates' };
  qs.set('start_date', s);
  qs.set('end_date', e);
  qs.set('nights', params.get('nights') || '1');
  if (params.has('source')) {
    const list = params.get('source').split(',');
    if (!list.every(x => ROOMS_SOURCES.includes(x))) return { error: 'source' };
    qs.set('source', [...new Set(list)].join(','));
  }
  if (params.has('max_points')) qs.set('max_points', params.get('max_points'));
  const take = params.get('take') || '100';
  if (+take > 500) return { error: 'take' };
  qs.set('take', take);
  if (params.has('skip')) qs.set('skip', params.get('skip'));
  return { qs };
}

// this account's rooms.aero calls today, and the key's last known remaining count; one D1 read
const STATE_SQL = 'SELECT (SELECT calls FROM rooms_usage WHERE user_id = ? AND day = ?) AS used, ' +
  '(SELECT remaining FROM rooms_quota WHERE id = 1) AS remaining, (SELECT quota_limit FROM rooms_quota WHERE id = 1) AS quota_limit, ' +
  '(SELECT at FROM rooms_quota WHERE id = 1) AS at';
const roomsState = (env, s, day) => env.DB.prepare(STATE_SQL).bind(s.id, day).first();
const midnight = day => Math.floor(Date.parse(day + 'T00:00:00Z') / 1000);
// an account's hotel calls a day: no cap for the owner, ROOMS_DAILY for every invited account (100 each, as the
// spec says). The admin's per-account daily limit is left out on purpose: the admin page asks for it as seats.aero
// calls only, and an account is cut off altogether by disabling it, which also ends its sessions.
const capOf = s => (s.role === 'owner' ? null : ROOMS_DAILY);
// one call taken from the account's cap in a single statement: no row comes back when the cap is reached, so two
// searches at the same moment (two tabs, two phones) cannot both take the last call
const TAKE_SQL = 'INSERT INTO rooms_usage (user_id, day, calls) VALUES (?, ?, 1) ' +
  'ON CONFLICT(user_id, day) DO UPDATE SET calls = calls + 1 WHERE calls < ? RETURNING calls';
const GIVE_BACK_SQL = 'UPDATE rooms_usage SET calls = MAX(0, calls - 1) WHERE user_id = ? AND day = ?';

// For an invited account: refuse at the cap, or when rooms.aero is down to the owner's reserve, otherwise take the
// call now (search() gives it back when rooms.aero did not count it). null = go ahead, else the refusal to send.
async function roomsTake(env, s, h, lib, day) {
  const cap = capOf(s);
  const st = await roomsState(env, s, day);
  const used = (st && st.used) || 0;
  if (used >= cap) return lib.json({ error: 'rooms_quota', used, limit: cap }, 429, h);
  if (st && st.at != null && st.at >= midnight(day) && st.remaining <= ROOMS_RESERVE) return lib.json({ error: 'rooms_reserve' }, 429, h);
  const took = await env.DB.prepare(TAKE_SQL).bind(s.id, day, cap).first();
  if (!took) return lib.json({ error: 'rooms_quota', used: cap, limit: cap }, 429, h);
  return null;
}

// rooms.aero refused the key (401), is out of calls (429) or failed (5xx): nothing to count against the account
const counted = status => status !== 401 && status !== 429 && status < 500;

// GET /hotels/search: the page's query, checked, once to rooms.aero
async function search({ env, ctx, s, url, h, lib }) {
  const day = lib.utcDay();
  const q = cleanHotelQuery(url.searchParams, day);
  if (q.error) return lib.json({ error: 'param', param: q.error }, 400, h);
  const owner = s.role === 'owner';
  if (!owner) {
    const stop = await roomsTake(env, s, h, lib, day);
    if (stop) return stop;
  }
  const giveBack = () => env.DB.prepare(GIVE_BACK_SQL).bind(s.id, day);
  let r;
  try {
    r = await fetch(ROOMS_UPSTREAM + '/search?' + q.qs, { headers: lib.seatsHeaders(env) });
  } catch (e) {
    console.error('rooms.aero', e && e.message);
    if (!owner) ctx.waitUntil(giveBack().run().catch(err => console.error('rooms usage', err)));
    return lib.json({ error: 'rooms_down' }, 502, h);
  }
  const out = new Headers(h);
  out.set('Content-Type', r.headers.get('Content-Type') || 'application/json');
  out.set('Cache-Control', 'no-store');
  const left = parseInt(r.headers.get('X-RateLimit-Remaining'), 10), lim = parseInt(r.headers.get('X-RateLimit-Limit'), 10);
  if (Number.isFinite(left)) out.set('X-Rooms-RateLimit-Remaining', String(left));
  if (Number.isFinite(lim)) out.set('X-Rooms-RateLimit-Limit', String(lim));
  // after the answer: settle the count (the owner's is written now, an invited account's was taken before the call
  // and goes back when rooms.aero did not count it) and keep rooms.aero's remaining count (D1, not KV: KV allows
  // 1,000 writes a day)
  const writes = [];
  if (owner && counted(r.status)) {
    writes.push(env.DB.prepare('INSERT INTO rooms_usage (user_id, day, calls) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET calls = calls + 1').bind(s.id, day));
  } else if (!owner && !counted(r.status)) writes.push(giveBack());
  if (Number.isFinite(left)) {
    writes.push(env.DB.prepare('INSERT INTO rooms_quota (id, remaining, quota_limit, at) VALUES (1, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET remaining = excluded.remaining, quota_limit = excluded.quota_limit, at = excluded.at')
      .bind(left, Number.isFinite(lim) ? lim : null, lib.now()));
  }
  if (writes.length) ctx.waitUntil(env.DB.batch(writes).catch(e => console.error('rooms usage', e)));
  return new Response(r.body, { status: r.status, headers: out });
}

// GET /hotels/quota: rooms.aero's last reported count and this account's own calls today, without a rooms.aero call.
// The page works out whether the UTC-midnight reset has passed since `at`.
async function quota({ env, s, h, lib }) {
  const st = await roomsState(env, s, lib.utcDay());
  const owner = s.role === 'owner';
  const me = { used: (st && st.used) || 0, limit: capOf(s), reserve: owner ? null : ROOMS_RESERVE };
  return lib.json(st && st.at != null ? { remaining: st.remaining, limit: st.quota_limit || 1000, at: st.at, me } : { remaining: null, limit: 1000, at: null, me }, 200, h);
}

export const routes = [
  // query: location (or sw_lat, sw_lng, ne_lat, ne_lng), start_date, end_date, nights, source, max_points, take, skip
  // answers rooms.aero's reply as it is, plus X-Rooms-RateLimit-Remaining and X-Rooms-RateLimit-Limit
  { method: 'GET', path: '/hotels/search', auth: 'user', handler: search },
  // { remaining, limit, at, me: { used, limit, reserve } }
  { method: 'GET', path: '/hotels/quota', auth: 'user', handler: quota },
];

export function onDeleteUser(env, uid) {
  return env.DB.prepare('DELETE FROM rooms_usage WHERE user_id = ?').bind(uid);
}
