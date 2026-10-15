// 用量圖 (usage chart for the owner), Gino 2026-10-15. The admin page draws the last 14 UTC days of seats.aero
// calls, stacked by account, against the key's 1,000 a day. This answers what it needs from D1 in one request:
//   usage        (migration 0005) one row per account and UTC day, real seats.aero calls only (cache hits are free)
//   rooms_usage  hotel (rooms.aero) calls, the same shape (user_id, day, calls), kept by the hotels feature. The
//                table may not exist yet, so it is read inside a try/catch and answered as null when it is missing.
// No seats.aero call here, and no table of its own (no migration).

export const name = 'usage';

export const DAYS_DEFAULT = 14;
export const DAYS_MAX = 60;

// ?days= as a whole number from 1 to 60; missing means 14; anything else is null (answered 400 param)
export function parseDays(v) {
  if (v == null) return DAYS_DEFAULT;
  if (!/^\d{1,2}$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= DAYS_MAX ? n : null;
}

// the n UTC days that end on `last` (YYYY-MM-DD), oldest first
export function dayList(last, n) {
  const end = Date.parse(last + 'T00:00:00Z');
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * 86400000).toISOString().slice(0, 10));
}

// One table's rows inside the window. Both tables' primary key is (user_id, day) and neither has an index on day,
// so a filter on day alone would read every row ever written. Going account by account instead (CROSS JOIN keeps
// users as the outer loop in SQLite) reads each account's primary-key range for the window only: about accounts x
// days rows, however long the history gets. Rows of a deleted account are not listed, and there are none to list:
// both tables cascade from users, and removeUser and the hotels feature's onDeleteUser delete them as well.
export const windowSql = table => 'SELECT x.user_id, x.day, x.calls FROM users u CROSS JOIN ' + table + ' x ' +
  'WHERE x.user_id = u.id AND x.day >= ? AND x.day <= ? AND x.calls > 0 ORDER BY x.day, x.user_id';

const num = v => (Number.isFinite(v) ? v : Number(v) || 0);
const rowsOut = rows => rows.map(r => ({ user_id: num(r.user_id), day: String(r.day), calls: num(r.calls) }));

// GET /admin/usage?days=14 -> { days: [YYYY-MM-DD...], users: [{ id, email, role }], calls: [{ user_id, day, calls }],
// rooms: [{ user_id, day, calls }] or null }. users lists every account (oldest first) so the page can name them;
// calls and rooms hold only days with at least one call.
async function usage({ env, url, h, lib }) {
  const n = parseDays(url.searchParams.get('days'));
  if (!n) return lib.json({ error: 'param' }, 400, h);
  const days = dayList(lib.utcDay(), n), from = days[0], to = days[n - 1];
  const [u, c] = await env.DB.batch([
    env.DB.prepare('SELECT id, email, role FROM users ORDER BY id'),
    env.DB.prepare(windowSql('usage')).bind(from, to),
  ]);
  let rooms = null;
  try {
    const r = await env.DB.prepare(windowSql('rooms_usage')).bind(from, to).all();
    rooms = rowsOut(r.results || []);
  } catch {
    rooms = null;   // no rooms_usage table (the hotels feature is not deployed), or not the shape above
  }
  return lib.json({
    days,
    users: (u.results || []).map(x => ({ id: num(x.id), email: x.email, role: x.role })),
    calls: rowsOut(c.results || []),
    rooms,
  }, 200, h);
}

export const routes = [
  { method: 'GET', path: '/admin/usage', auth: 'owner', handler: usage },
];
