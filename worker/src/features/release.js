// 開票日 (award release dates) and 開票提醒 (a reminder email on the day a travel date opens), 2026-10-15.
//
// WINDOWS: how many days before departure each seats.aero program opens award bookings, checked 2026-10-14
// (research: .claude/tmp/award-search/release-windows.json; the page file features/release.js keeps the same
// numbers with notes and sources). A reminder is one program and one travel date of one account; its open_date is
// the travel date minus the program's window. Once a day, in the hourly cron's 14:05 UTC run (22:05 in Taipei,
// 07:05 in Seattle), up to ACCOUNTS_PER_RUN accounts with reminders due get one email each listing them (Cloudflare
// only delivers to verified addresses, so accounts without mail_verified_at are skipped). Right after each email,
// exactly the reminders in it get sent_at, so a run cut short (CPU or subrequest limits) never emails them twice;
// a failed email sets tried_at instead, and those accounts wait behind the others the next day.
// Accounts whose alerts the admin switched off (users.alerts_ok = 0) cannot add reminders and get no email.
// No seats.aero calls here.
//
// Routes (auth 'user'): GET /me/reminders, POST /me/reminders, DELETE /me/reminders/:id.
// Table: release_reminders (migrations/0008_release.sql).

export const name = 'release';
export const AS_OF = '2026-10-14';

// days: the window; status: confirmed, corrected (was = the figure it replaced), approx, or unknown (days null).
// lo/hi: the range when sources disagree. A reminder and the sorting use hi, the earliest day the program may
// open, so nobody hears about it after the seats are gone; the email then says it "may" be open.
// Spirit is not here: it stopped flying in May 2026.
export const WINDOWS = {
  united: { days: 337, status: 'confirmed' },
  aeroplan: { days: 355, status: 'confirmed' },
  turkish: { days: 355, status: 'approx', lo: 330, hi: 355 },
  singapore: { days: 355, status: 'confirmed' },
  lufthansa: { days: 361, status: 'confirmed' },
  connectmiles: { days: 330, status: 'approx', lo: 330, hi: 337 },
  ethiopian: { days: 331, status: 'confirmed' },
  lifemiles: { days: 360, status: 'corrected', was: 355 },
  american: { days: 331, status: 'confirmed' },
  alaska: { days: 330, status: 'confirmed' },
  qantas: { days: 353, status: 'confirmed' },
  qatar: { days: 361, status: 'confirmed' },
  finnair: { days: 360, status: 'confirmed' },
  british: { days: 354, status: 'corrected', was: 355 },
  iberia: { days: 360, status: 'confirmed' },
  delta: { days: 331, status: 'confirmed' },
  flyingblue: { days: 359, status: 'confirmed' },
  virginatlantic: { days: 331, status: 'confirmed' },
  aeromexico: { days: 330, status: 'confirmed' },
  eurobonus: { days: 330, status: 'confirmed' },
  saudia: { days: 330, status: 'approx' },
  emirates: { days: 328, status: 'confirmed' },
  etihad: { days: 330, status: 'confirmed' },
  velocity: { days: 331, status: 'confirmed' },
  jetblue: { days: 331, status: 'confirmed' },
  azul: { days: 330, status: 'approx' },
  smiles: { days: 330, status: 'confirmed' },
  frontier: { days: null, status: 'unknown' },
};

export const REMINDERS_MAX = 30;    // unsent reminders per account
export const MAX_AHEAD = 400;       // a travel date at most this many days after today (UTC)
export const SEND_HOUR = 14;        // the UTC hour of the run that sends (the cron runs at minute 5)
export const ACCOUNTS_PER_RUN = 10; // emails per run (digest.js shares the 14 UTC run); the rest go the next day
export const KEEP_SENT_DAYS = 30;   // a sent reminder is removed this many days after its email
const AIRPORTS = /^[A-Z]{3}(,[A-Z]{3}){0,19}$/;   // the same rule as the search form and lib.AIRPORTS
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- dates (UTC calendar days, no time zones) ---------- */

export function addDays(iso, n) {
  const t = Date.parse(iso + 'T00:00:00Z');
  return Number.isFinite(t) ? new Date(t + n * 86400000).toISOString().slice(0, 10) : null;
}
// a real calendar day: Date.parse rolls 2026-02-30 over to March, so the day must survive the round trip
export const realDay = s => typeof s === 'string' && ISO.test(s) && addDays(s, 0) === s;
export const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
// the days ahead a reminder uses: the window, or the longest end of a range; null when not fixed or unknown
export function leadDays(src) {
  const w = Object.prototype.hasOwnProperty.call(WINDOWS, src) ? WINDOWS[src] : null;
  return w && w.days != null ? (w.hi || w.days) : null;
}
export function openDate(src, travel) {
  const n = leadDays(src);
  return n == null || !realDay(travel) ? null : addDays(travel, -n);
}

/* ---------- requests ---------- */

// POST body -> the row to store, or { error }. today: the UTC day (YYYY-MM-DD).
export function cleanReminder(b, today) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'param' };
  const source = typeof b.source === 'string' ? b.source : '';
  const days = leadDays(source);
  if (days == null) return { error: 'param' };
  const travel = b.travel_date;
  if (!realDay(travel) || travel <= today || dayDiff(today, travel) > MAX_AHEAD) return { error: 'param' };
  // o and d are optional (they make the email link a search); either one that is sent must be valid
  const air = v => (v == null || v === '' ? null : typeof v === 'string' && AIRPORTS.test(v.toUpperCase()) ? v.toUpperCase() : undefined);
  const o = air(b.o), d = air(b.d);
  if (o === undefined || d === undefined) return { error: 'param' };
  const open_date = addDays(travel, -days);
  // already open: before today (UTC). A date opening today is still taken, because in the Americas' evening the
  // page's own date is a day behind UTC: "opens tomorrow" there is today here, and today's 14:05 run sends it.
  if (open_date < today) return { error: 'already_open', open_date };
  return { source, travel_date: travel, open_date, days, o: o && d ? o : null, d: o && d ? d : null, lang: b.lang === 'en' ? 'en' : 'zh' };
}

const COLS = 'id, source, travel_date, open_date, days, o, d, lang, created_at, sent_at';
const out = r => ({ id: r.id, source: r.source, travel_date: r.travel_date, open_date: r.open_date, days: r.days, o: r.o || null, d: r.d || null,
  lang: r.lang, created_at: r.created_at, sent_at: r.sent_at || null });

// the admin's per-account switch, the same rule as /me/alerts: the owner is always on
const allowedOf = (s, u) => s.role === 'owner' || !!(u && u.alerts_ok === 1);

async function list({ env, s, h, lib }) {
  const [r, u] = await Promise.all([
    env.DB.prepare('SELECT ' + COLS + ' FROM release_reminders WHERE user_id = ? ORDER BY open_date, travel_date, id').bind(s.id).all(),
    env.DB.prepare('SELECT mail_verified_at, alerts_ok FROM users WHERE id = ?').bind(s.id).first(),
  ]);
  return lib.json({ reminders: r.results.map(out), max: REMINDERS_MAX, verified: !!(u && u.mail_verified_at), allowed: allowedOf(s, u), as_of: AS_OF }, 200, h);
}

// One reminder per account, program and travel date: asking again keeps the row and takes the new route and
// language (201 for a new one, 200 with existing: true for one that was already there). An account whose alerts
// are switched off gets 403 alerts_off: its reminders would never be emailed.
async function create({ req, env, s, h, lib }) {
  const r = cleanReminder(await lib.readJson(req), lib.utcDay());
  if (r.error) return lib.json(r, 400, h);
  if (!allowedOf(s, await env.DB.prepare('SELECT alerts_ok FROM users WHERE id = ?').bind(s.id).first())) return lib.json({ error: 'alerts_off' }, 403, h);
  const find = () => env.DB.prepare('SELECT ' + COLS + ' FROM release_reminders WHERE user_id = ? AND source = ? AND travel_date = ?').bind(s.id, r.source, r.travel_date).first();
  let row = await find();
  if (row) {
    // a row already emailed opened on or before its sending day; asking again does not send it a second time
    await env.DB.prepare('UPDATE release_reminders SET o = ?, d = ?, lang = ?, open_date = ?, days = ? WHERE id = ?')
      .bind(r.o, r.d, r.lang, r.open_date, r.days, row.id).run();
    return lib.json({ reminder: out({ ...row, ...r, id: row.id }), existing: true }, 200, h);
  }
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM release_reminders WHERE user_id = ? AND sent_at IS NULL').bind(s.id).first();
  if (n.n >= REMINDERS_MAX) return lib.json({ error: 'too_many', max: REMINDERS_MAX }, 400, h);
  const t = lib.now();
  // a second request racing this one lands on the unique index and only updates the route
  await env.DB.prepare('INSERT INTO release_reminders (user_id, source, travel_date, open_date, days, o, d, lang, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(user_id, source, travel_date) DO UPDATE SET o = excluded.o, d = excluded.d, lang = excluded.lang')
    .bind(s.id, r.source, r.travel_date, r.open_date, r.days, r.o, r.d, r.lang, t).run();
  row = await find();
  return lib.json({ reminder: out(row) }, 201, h);
}

async function remove({ env, s, h, m, lib }) {
  const r = await env.DB.prepare('DELETE FROM release_reminders WHERE id = ? AND user_id = ?').bind(Number(m[1]), s.id).run();
  return r.meta.changes ? lib.json({ ok: true }, 200, h) : lib.json({ error: 'not_found' }, 404, h);
}

export const routes = [
  { method: 'GET', path: '/me/reminders', auth: 'user', handler: list },
  { method: 'POST', path: '/me/reminders', auth: 'user', handler: create },
  { method: 'DELETE', path: /^\/me\/reminders\/(\d{1,12})$/, auth: 'user', handler: remove },
  // the 14:05 UTC run's sending, now (staging has no cron, and /admin/hourly/run skips it outside that hour)
  { method: 'POST', path: '/admin/release/run', auth: 'owner', handler: async ({ env, h, lib }) => lib.json({ ran: await sendDue({ env, lib, at: lib.now() }) }, 200, h) },
];

/* ---------- the email ---------- */

const ymd = iso => +iso.slice(0, 4) + '/' + +iso.slice(5, 7) + '/' + +iso.slice(8, 10);
const WORDS = {
  zh: {
    from: '里程機位搜尋', title: '開票提醒', intro: '你設的開票提醒到了：',
    // kind: exact, range (sources disagree) or approx (one source); late: the open date was before today
    line: (p, date, open, late, kind, r) => (kind === 'exact' ? (late ? `${p} 從 ${open} 起開放` : `今天 ${p} 開放`) : (late ? `${p} 可能從 ${open} 起開放` : `今天 ${p} 可能開放`)) +
      ` ${date} 的位子了` + (kind === 'range' ? `（各來源說提前 ${r.lo} 到 ${r.hi} 天）` : kind === 'approx' ? `（約提前 ${r.days} 天）` : `（提前 ${r.days} 天）`),
    subject1: (p, date, late, kind) => '✈️ ' + (kind === 'exact' ? (late ? `${p} 已經開放` : `今天 ${p} 開放`) : (late ? `${p} 可能已經開放` : `今天 ${p} 可能開放`)) + ` ${date} 的位子了`,
    subjectN: (n, names) => `✈️ ${n} 個開票提醒：${names}`, sep: '、', etc: ' 等',
    search: route => `搜尋 ${route}`, page: '看開票日',
    note: '開票日是從公開資料整理的，實際可能差一兩天。轉點數或訂位前，先到航空公司網站確認還有位子。', manage: '管理開票提醒',
  },
  en: {
    from: 'Award Search', title: 'Release reminders', intro: 'Your release reminders are due:',
    line: (p, date, open, late, kind, r) => (kind === 'exact' ? (late ? `${p} has been open for ${date} since ${open}` : `${p} opens seats for ${date} today`)
      : (late ? `${p} may have opened ${date} on ${open}` : `${p} may open seats for ${date} today`)) +
      (kind === 'range' ? ` (sources say ${r.lo} to ${r.hi} days ahead)` : kind === 'approx' ? ` (about ${r.days} days ahead)` : ` (${r.days} days ahead)`),
    subject1: (p, date, late, kind) => '✈️ ' + (kind === 'exact' ? (late ? `${p} is open for ${date}` : `${p} opens ${date} today`) : (late ? `${p} may be open for ${date}` : `${p} may open ${date} today`)),
    subjectN: (n, names) => `✈️ ${n} release reminders: ${names}`, sep: ', ', etc: ' and more',
    search: route => `Search ${route}`, page: 'See release dates',
    note: 'Release dates come from public sources and can be a day or two off. Check with the airline before you transfer points or book.', manage: 'Manage release reminders',
  },
};
const kindOf = src => { const w = WINDOWS[src]; return !w || w.status !== 'approx' ? 'exact' : w.lo ? 'range' : 'approx'; };
// the search a reminder's link opens: its route, the travel date and two days after, business class
export function linkOf(r, site) {
  if (!r.o || !r.d) return site + '#/release';
  return site + '#/s?' + new URLSearchParams({ o: r.o, d: r.d, s: r.travel_date, e: addDays(r.travel_date, 2), c: 'J' });
}

// One email for one account's due reminders (rows from release_reminders), in lang ('zh' or 'en').
export function reminderMail(rows, lang, site, today, lib) {
  const L = WORDS[lang] || WORDS.zh, esc = lib.escHtml, name = src => (lib.PROGRAM_NAME && lib.PROGRAM_NAME[src]) || src;
  const items = rows.map(r => {
    const w = WINDOWS[r.source] || {}, kind = kindOf(r.source), late = r.open_date < today;
    const line = L.line(name(r.source), ymd(r.travel_date), ymd(r.open_date), late, kind, { days: r.days, lo: w.lo, hi: w.hi });
    const route = r.o && r.d ? r.o.split(',').join('/') + ' → ' + r.d.split(',').join('/') : '';
    // the button names the route only; the line above already gives the date
    return { r, kind, late, line, url: linkOf(r, site), label: route ? L.search(route) : L.page };
  });
  const first = items[0];
  const names = [...new Set(rows.map(r => name(r.source)))];
  const subject = items.length === 1 ? L.subject1(name(first.r.source), ymd(first.r.travel_date), first.late, first.kind)
    : L.subjectN(items.length, names.slice(0, 3).join(L.sep) + (names.length > 3 ? L.etc : ''));
  const manage = site + '#/alerts';
  const text = [L.intro, '', ...items.flatMap(x => [x.line, x.label + ': ' + x.url, '']), L.note, L.manage + ': ' + manage].join('\n');
  const ink = '#3E3A39', soft = '#6B6461';
  const html = '<div style="background:#FFFCF6;padding:16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'PingFang TC\',\'Noto Sans TC\',sans-serif;color:' + ink + '">' +
    '<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:3px solid ' + ink + ';border-radius:18px;padding:18px 18px 14px">' +
    '<div style="font-size:20px;font-weight:bold;margin:0 0 6px">✈️ ' + esc(L.title) + '</div>' +
    '<p style="margin:0 0 6px;font-size:15px;line-height:1.5">' + esc(L.intro) + '</p>' +
    items.map(x => '<div style="padding:10px 0 12px;border-top:1px dashed ' + ink + '"><div style="font-size:15px;line-height:1.5">' + esc(x.line) + '</div>' +
      '<p style="margin:8px 0 0"><a href="' + esc(x.url) + '" style="display:inline-block;background:#F2A497;color:' + ink + ';border:3px solid ' + ink + ';border-radius:999px;padding:6px 16px;text-decoration:none;font-weight:bold">' + esc(x.label) + '</a></p></div>').join('') +
    '<p style="margin:6px 0 0;font-size:12px;line-height:1.5;color:' + soft + '">' + esc(L.note) + '<br><a href="' + esc(manage) + '" style="color:' + ink + '">' + esc(L.manage) + '</a></p>' +
    '</div></div>';
  return { from: L.from, subject, text, html };
}

/* ---------- the hourly cron ---------- */

// at: the run's time (Unix seconds). Only the 14:xx UTC run works.
export async function hourly({ env, lib, at }) {
  if (new Date(at * 1000).getUTCHours() !== SEND_HOUR) return { skipped: 'hour' };
  return sendDue({ env, lib, at });
}
// The accounts this run emails: they can receive mail (verified address, active, alerts not switched off by the
// admin); those whose last email failed come after the rest (the longest-ago failure first), so accounts whose mail
// keeps failing cannot take every place; then the oldest open date first. ?1 = today, ?2 = how many.
const PICK = 'SELECT r.user_id FROM release_reminders r JOIN users u ON u.id = r.user_id ' +
  "WHERE r.sent_at IS NULL AND r.open_date <= ?1 AND u.mail_verified_at IS NOT NULL AND u.status = 'active' AND (u.alerts_ok = 1 OR u.role = 'owner') " +
  'GROUP BY r.user_id ORDER BY COALESCE(MAX(r.tried_at), 0), MIN(r.open_date), r.user_id LIMIT ?2';
const DUE = 'SELECT r.id, r.user_id, r.source, r.travel_date, r.open_date, r.days, r.o, r.d, r.lang, r.created_at, r.tried_at, u.email ' +
  'FROM release_reminders r JOIN users u ON u.id = r.user_id WHERE r.sent_at IS NULL AND r.open_date <= ?1 AND r.user_id IN (' + PICK + ') ' +
  'ORDER BY r.open_date, r.travel_date, r.id';

// Tidy up, then email up to ACCOUNTS_PER_RUN accounts, one email each. Each account's rows are marked right after
// its own email, by id: sent_at when it went out, tried_at when it failed. D1 work: one batch of clean-up, one
// read, then one send and one update per account (at most 3 + 2 x ACCOUNTS_PER_RUN subrequests).
export async function sendDue({ env, lib, at }) {
  const today = new Date(at * 1000).toISOString().slice(0, 10);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM release_reminders WHERE travel_date < ?').bind(today),
    env.DB.prepare('DELETE FROM release_reminders WHERE sent_at IS NOT NULL AND sent_at < ?').bind(at - KEEP_SENT_DAYS * 86400),
  ]);
  const rows = (await env.DB.prepare(DUE).bind(today, ACCOUNTS_PER_RUN).all()).results;
  if (!rows.length) return { accounts: 0, reminders: 0, failed: 0 };
  // group by account, in PICK's order
  const by = new Map();
  for (const r of rows) {
    let a = by.get(r.user_id);
    if (!a) by.set(r.user_id, (a = { uid: r.user_id, email: r.email, tried: 0, first: r.open_date, rows: [] }));
    a.rows.push(r);
    a.tried = Math.max(a.tried, r.tried_at || 0);
  }
  const queue = [...by.values()].sort((x, y) => x.tried - y.tried || (x.first < y.first ? -1 : x.first > y.first ? 1 : x.uid - y.uid));
  const site = env.SITE_URL || 'https://award.ginochang.com/';
  let accounts = 0, reminders = 0, failed = 0;
  for (const a of queue) {
    const mine = a.rows.slice(0, REMINDERS_MAX);   // never more than one statement's worth of ids (D1: 100 values)
    const lang = mine.reduce((x, y) => (y.created_at > x.created_at ? y : x)).lang;   // the newest reminder's language
    const mail = reminderMail(mine, lang, site, today, lib);
    let ok = true;
    try {
      await lib.sendMail(env, a.email, mail.from, mail.subject, mail.text, mail.html);
      accounts++;
      reminders += mine.length;
    } catch (e) {
      ok = false;
      failed++;   // left unsent; tried again in the next day's run, after the accounts that did not fail
      console.error('release mail', a.uid, e && e.message);
    }
    const ids = mine.map(x => x.id);
    try {
      await env.DB.prepare('UPDATE release_reminders SET ' + (ok ? 'sent_at' : 'tried_at') + ' = ? WHERE id IN (' + ids.map(() => '?').join(', ') + ')').bind(at, ...ids).run();
    } catch (e) {
      // D1 is failing or the run is out of subrequests: stop here; what is not marked goes in a later run
      console.error('release mark', a.uid, e && e.message);
      return { accounts, reminders, failed, stopped: true };
    }
  }
  return { accounts, reminders, failed };
}

export function onDeleteUser(env, uid) {
  return env.DB.prepare('DELETE FROM release_reminders WHERE user_id = ?').bind(uid);
}
