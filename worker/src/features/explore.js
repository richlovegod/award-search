// Feature module: 探索 (explore), 2026-10-15.
//   GET /explore/destinations?from=XXX (or ?to=XXX): every airport seats.aero knows a nonstop route to (or from),
//     each with the lowest miles per cabin seen in its cache, any program and any date. A successful answer is
//     kept 6 hours in KV under dest:from:XXX (or dest:to:XXX), so asking again, by anyone, costs no call.
//   GET /explore/availability: seats.aero's bulk availability for one program, cabin and pair of regions, at most
//     1,000 rows per call in date order; cursor + skip (from the last answer) fetch the next 1,000. Streamed back.
// A request that reaches seats.aero is 1 real call, counted against the account like a search.
// getDestinations() is the same lookup for other modules (the daily digest), with or without an account.
export const name = 'explore';

const AIRPORT = /^[A-Z]{3}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CABINS = ['economy', 'premium', 'business', 'first'];
const REGIONS = ['North America', 'South America', 'Africa', 'Asia', 'Europe', 'Oceania'];   // seats.aero's names
const DEST_TTL = 21600;   // seconds a destinations answer stays in KV
const SPAN_MAX = 92;      // the longest availability range: days from start_date to end_date
const AHEAD_MAX = 400;    // the latest end_date: days after today (UTC)
const AVAIL_KEYS = ['source', 'cabin', 'origin_region', 'destination_region', 'start_date', 'end_date', 'cursor', 'skip'];

const destKey = (kind, code) => 'dest:' + kind + ':' + code;
const dayPlus = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
// a real calendar day in YYYY-MM-DD (2026-02-30 is not)
function realDay(s) {
  if (typeof s !== 'string' || !DAY.test(s)) return false;
  const ms = Date.parse(s + 'T00:00:00Z');
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === s;
}
// the one value of a query parameter: undefined when absent, null when given more than once
function one(params, k) {
  const v = params.getAll(k);
  return v.length === 1 ? v[0] : v.length ? null : undefined;
}
// X-Cache tells a hit (no call) from a miss; the page can read it once it is in the exposed list
function markCache(headers, state) {
  headers.set('X-Cache', state);
  const exposed = headers.get('Access-Control-Expose-Headers');
  headers.set('Access-Control-Expose-Headers', exposed ? exposed + ', X-Cache' : 'X-Cache');
  return headers;
}
async function cached(env, key) {
  try { return await env.KV.get(key); } catch (e) { console.error('explore kv get', e && e.message); return null; }
}

// One /destinations lookup at seats.aero. A 200 answer with success: true is kept in KV.
// Returns { r, text, data } where data is the parsed answer when it was a success, else null.
async function fetchDest(env, ctx, lib, kind, code) {
  const r = await fetch(lib.UPSTREAM + '/destinations?' + (kind === 'from' ? 'origin_airport=' : 'destination_airport=') + code,
    { headers: lib.seatsHeaders(env) });
  const text = await r.text();
  let data = null;
  if (r.status === 200) { try { data = JSON.parse(text); } catch { data = null; } }
  if (!data || data.success !== true) return { r, text, data: null };
  ctx.waitUntil(env.KV.put(destKey(kind, code), text, { expirationTtl: DEST_TTL })
    .catch(e => console.error('explore kv put', e && e.message)));
  return { r, text, data };
}

async function destinations({ env, ctx, s, url, h, lib }) {
  const keys = [...url.searchParams.keys()];
  if (keys.length !== 1 || (keys[0] !== 'from' && keys[0] !== 'to')) return lib.json({ error: 'param' }, 400, h);
  const kind = keys[0], code = url.searchParams.get(kind);
  if (!AIRPORT.test(code)) return lib.json({ error: 'param' }, 400, h);
  const hit = await cached(env, destKey(kind, code));
  if (hit != null) {
    const out = new Headers(h);
    out.set('Content-Type', 'application/json; charset=utf-8');
    out.set('Cache-Control', 'no-store');
    return new Response(hit, { status: 200, headers: markCache(out, 'hit') });
  }
  const stop = await lib.budgetCheck(env, s, h, 1);
  if (stop) return stop;
  let got;
  try { got = await fetchDest(env, ctx, lib, kind, code); } catch (e) {
    console.error('explore destinations', e && e.message);
    return lib.json({ error: 'upstream' }, 502, h);
  }
  lib.spend(env, ctx, s, 1);
  return new Response(got.text, { status: got.r.status, headers: markCache(lib.passOn(got.r, env, h, ctx), 'miss') });
}

async function availability({ env, ctx, s, url, h, lib }) {
  const P = url.searchParams, bad = () => lib.json({ error: 'param' }, 400, h);
  for (const k of P.keys()) if (!AVAIL_KEYS.includes(k)) return bad();
  const v = {};
  for (const k of AVAIL_KEYS) {
    const x = one(P, k);
    if (x === null) return bad();
    v[k] = x;
  }
  if (!v.source || !Object.prototype.hasOwnProperty.call(lib.PROGRAM_NAME, v.source)) return bad();
  if (!CABINS.includes(v.cabin) || !REGIONS.includes(v.origin_region) || !REGIONS.includes(v.destination_region)) return bad();
  if (!realDay(v.start_date) || !realDay(v.end_date) || v.end_date < v.start_date) return bad();
  const today = lib.utcDay();
  if (v.start_date < dayPlus(today, -1) || v.end_date > dayPlus(today, AHEAD_MAX)) return bad();
  if (lib.daysBetween(v.start_date, v.end_date) > SPAN_MAX) return bad();
  if (v.cursor !== undefined && !/^\d{1,20}$/.test(v.cursor)) return bad();
  if (v.skip !== undefined && !/^\d{1,6}$/.test(v.skip)) return bad();
  const qs = new URLSearchParams({
    source: v.source, cabin: v.cabin, origin_region: v.origin_region, destination_region: v.destination_region,
    start_date: v.start_date, end_date: v.end_date, take: '1000',
  });
  if (v.cursor !== undefined) qs.set('cursor', v.cursor);
  if (v.skip !== undefined) qs.set('skip', v.skip);
  const stop = await lib.budgetCheck(env, s, h, 1);
  if (stop) return stop;
  let r;
  try { r = await fetch(lib.UPSTREAM + '/availability?' + qs, { headers: lib.seatsHeaders(env) }); } catch (e) {
    console.error('explore availability', e && e.message);
    return lib.json({ error: 'upstream' }, 502, h);
  }
  lib.spend(env, ctx, s, 1);
  return new Response(r.body, { status: r.status, headers: lib.passOn(r, env, h, ctx) });
}

export const routes = [
  { method: 'GET', path: '/explore/destinations', auth: 'user', handler: destinations },
  { method: 'GET', path: '/explore/availability', auth: 'user', handler: availability },
];

// For other modules (the daily digest): the destinations from (kind 'from') or to (kind 'to') one airport, as
// { destinations: [{ airport, economy, premium, business, first }], ... } or null. Uses the same KV cache. With an
// account s, the call is checked and counted against it (null when its budget says no); with s null (a cron),
// there is no account budget, but the key's remaining count is still recorded.
export async function getDestinations(env, ctx, lib, kind, code, s) {
  if ((kind !== 'from' && kind !== 'to') || typeof code !== 'string' || !AIRPORT.test(code)) return null;
  const hit = await cached(env, destKey(kind, code));
  if (hit != null) {
    try { const d = JSON.parse(hit); if (d && Array.isArray(d.destinations)) return d; } catch { /* fetched again below */ }
  }
  if (s && await lib.budgetCheck(env, s, {}, 1)) return null;
  let got;
  try { got = await fetchDest(env, ctx, lib, kind, code); } catch (e) {
    console.error('explore getDestinations', e && e.message);
    return null;
  }
  if (s) lib.spend(env, ctx, s, 1);
  lib.passOn(got.r, env, {}, ctx);
  return got.data && Array.isArray(got.data.destinations) ? got.data : null;
}
