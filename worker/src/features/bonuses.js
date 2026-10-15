// 轉點加碼 (transfer bonuses), Gino 2026-10-15. For a while a bank (or Marriott) can give extra miles when points
// move to an airline program, e.g. Amex to Flying Blue +25% until 11/15. The owner records them on the admin page;
// every signed-in account reads them (GET /bonuses), and the page marks the cards of a program with a bonus running
// today and works out, in a card's details, the points needed with the bonus. No seats.aero call anywhere here.
//
// Dates are US Eastern calendar days (YYYY-MM-DD; the end is the last day the bonus runs), the way banks announce
// them. The page works out the Eastern date and decides with it whether a bonus is running, still to come, or over.
// The Worker stays looser on purpose: the list keeps a bonus until its last day has ended everywhere (UTC-12), and
// the limits are counted from UTC-12 and UTC+14, which always enclose the Eastern date, so whatever the page
// accepts passes here too. Table: migrations/0010_bonuses.sql.

export const name = 'bonuses';

const BANKS = ['amex', 'chase', 'citi', 'capitalone', 'marriott'];   // the page's BANKS keys
const LIST_MAX = 50;      // GET answers at most this many, so POST refuses a 51st live one
const YEAR_DAYS = 365;    // the end at most this many days after the owner's today, the start at most this many before
const KEEP_DAYS = 30;     // the hourly clean-up deletes bonuses that ended more than this many days ago
const NOTE_MAX = 40;      // characters

const dayOf = ms => new Date(ms).toISOString().slice(0, 10);
// the earliest and the latest calendar dates in use anywhere right now (UTC-12 and UTC+14). The page checks against
// the US Eastern date, one of the dates in between, so each limit is counted from the end of the range that lets the
// page through: a last day on the earliest date is never refused while the page still shows it running.
const earliestDay = ms => dayOf(ms - 12 * 3600 * 1000);
const latestDay = ms => dayOf(ms + 14 * 3600 * 1000);
// a real date written YYYY-MM-DD (2026-02-30 is not one)
const realDay = (lib, s) => typeof s === 'string' && lib.DAY.test(s) && dayOf(Date.parse(s + 'T00:00:00Z') || 0) === s;

// the request body as a bonus, or { error, field } saying what is wrong with it
export function cleanBonus(b, lib, nowMs) {
  const bad = field => ({ error: 'param', field });
  if (!b || typeof b !== 'object') return bad('body');
  if (!BANKS.includes(b.bank)) return bad('bank');
  if (typeof b.source !== 'string' || !/^[a-z0-9]{2,20}$/.test(b.source) || !Object.prototype.hasOwnProperty.call(lib.PROGRAM_NAME, b.source)) return bad('source');
  if (!Number.isInteger(b.pct) || b.pct < 1 || b.pct > 200) return bad('pct');
  if (!realDay(lib, b.start)) return bad('start');
  if (!realDay(lib, b.end) || b.end < b.start) return bad('end');
  if (b.end < earliestDay(nowMs)) return { error: 'bonus_past', field: 'end' };
  // at most a year out (the page allows 365 days from the Eastern date; this allows 365 from UTC+14's date)
  if (lib.daysBetween(latestDay(nowMs), b.end) > YEAR_DAYS) return bad('end');
  // a start more than a year back is a typo (counted from UTC-12's date, so the page's 365 from Eastern always passes)
  if (lib.daysBetween(b.start, earliestDay(nowMs)) > YEAR_DAYS) return bad('start');
  if (b.note != null && typeof b.note !== 'string') return bad('note');
  const note = [...String(b.note == null ? '' : b.note).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()].slice(0, NOTE_MAX).join('').trim();
  return { bank: b.bank, source: b.source, pct: b.pct, start: b.start, end: b.end, note: note || null };
}

const out = r => ({ id: r.id, bank: r.bank, source: r.source, pct: r.pct, start: r.starts_on, end: r.ends_on, note: r.note });

// running and upcoming bonuses (last day not yet over everywhere), soonest first
async function list(env, nowMs) {
  const r = await env.DB.prepare('SELECT id, bank, source, pct, starts_on, ends_on, note FROM bonuses WHERE ends_on >= ? ORDER BY starts_on, ends_on, id LIMIT ?')
    .bind(earliestDay(nowMs), LIST_MAX).all();
  return r.results.map(out);
}

export const routes = [
  // { bonuses: [{ id, bank, source, pct, start, end, note }], max }
  { method: 'GET', path: '/bonuses', auth: 'user', handler: async ({ env, h, lib }) => lib.json({ bonuses: await list(env, Date.now()), max: LIST_MAX }, 200, h) },

  // body { bank, source, pct, start, end, note }; answers 201 { id, bonuses } (the new list, so the page needs no GET)
  { method: 'POST', path: '/admin/bonuses', auth: 'owner', handler: async ({ req, env, s, h, lib }) => {
    const nowMs = Date.now();
    const b = cleanBonus(await lib.readJson(req), lib, nowMs);
    if (b.error) return lib.json(b, 400, h);
    const live = await env.DB.prepare('SELECT COUNT(*) AS n FROM bonuses WHERE ends_on >= ?').bind(earliestDay(nowMs)).first();
    if (live.n >= LIST_MAX) return lib.json({ error: 'bonus_many', max: LIST_MAX }, 400, h);
    const ins = await env.DB.prepare('INSERT INTO bonuses (bank, source, pct, starts_on, ends_on, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(b.bank, b.source, b.pct, b.start, b.end, b.note, s.id, lib.now()).run();
    return lib.json({ id: ins.meta.last_row_id, bonuses: await list(env, nowMs), max: LIST_MAX }, 201, h);
  } },

  // answers { ok, bonuses }, or 404 { error: 'not_found' } when there is no such bonus
  { method: 'DELETE', path: /^\/admin\/bonuses\/(\d{1,12})$/, auth: 'owner', handler: async ({ env, h, m, lib }) => {
    const r = await env.DB.prepare('DELETE FROM bonuses WHERE id = ?').bind(Number(m[1])).run();
    if (!r.meta.changes) return lib.json({ error: 'not_found' }, 404, h);
    return lib.json({ ok: true, bonuses: await list(env, Date.now()), max: LIST_MAX }, 200, h);
  } },
];

// the "5 * * * *" cron: bonuses whose last day is more than 30 days before today (UTC) are deleted
export async function hourly({ env, at }) {
  const r = await env.DB.prepare('DELETE FROM bonuses WHERE ends_on < ?').bind(dayOf(at * 1000 - KEEP_DAYS * 86400 * 1000)).run();
  return { deleted: r.meta.changes || 0 };
}

// a deleted owner's bonuses stay (they are the site's, not the account's); only the link to the account goes
export function onDeleteUser(env, uid) {
  return env.DB.prepare('UPDATE bonuses SET created_by = NULL WHERE created_by = ?').bind(uid);
}
