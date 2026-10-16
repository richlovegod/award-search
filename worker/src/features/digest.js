// 每日精選信 (daily digest email), Gino 2026-10-15. Once a day, at 8 am in Taiwan or 7 am in Seattle, an account can
// get one email that lists, for each of its home airports (TPE, TSA, SEA and up to 3 others), the cheapest nonstop
// business and/or first class destinations seen in seats.aero's cache (any program, any date): the top 10 per airport
// and cabin, cheapest first, each marked new or cheaper against what the last digest saw (the snapshot in D1).
// One destinations lookup per airport (getDestinations in explore.js: about 1 seats.aero call, counted against the
// account like a search). Mail goes only to an address verified with Cloudflare, and only while the account's alerts
// are allowed (the admin page's switch), like the alerts.
//   GET  /me/digest        the settings, the last digest's top 3 per airport and cabin, whether alerts are allowed
//   PUT  /me/digest        save the settings (the page saves on every change; lang = the site's language then)
//   POST /me/digest/test   寄一封給我看看: build it now and send it (verified address) or return a preview; 3 an hour
// The hourly cron ("5 * * * *") sends what is due: a send hour's window is that hour and the next two. A run takes at
// most 5 accounts, 6 lookups that bring data, 9 tries in all and 27 D1 queries (the hourly hooks of every module
// share one invocation and its 50 queries). A lookup that reached seats.aero and brought nothing is not tried again
// in that run. An account that got no data or whose email failed tries
// again the next hour, behind the accounts not tried yet, so one failing account cannot hold up the rest.
// The day is claimed in D1 before the email goes out (and given back if sending fails), so it never goes twice.
import { getDestinations } from './explore.js';

export const name = 'digest';

const HOME = ['TPE', 'TSA', 'SEA'];   // the card's fixed chips
const OTHERS_MAX = 3;                 // other airports an account may add
const FIELD = { J: 'business', F: 'first' };   // the getDestinations field of each cabin
const CABS = ['J', 'F'];
const HOURS = [0, 14];                // 0 = 8 am in Taiwan (00 UTC all year); 14 = 7 am in Seattle (14 UTC, 15 in winter)
const TOP = 10;                       // destinations per airport and cabin in an email
const MIN_MILES = 1000;               // lower values are noise
const PER_RUN = 5;                    // accounts per hourly run
const LOOKUPS_PER_RUN = 6;            // fresh destination lookups that brought data, per run (one 6-airport account fits)
const TRIES_PER_RUN = 9;              // fresh lookups tried per run, failed ones included
// D1 queries. The free plan allows 50 per invocation, and runHourly calls every module's hourly hook in one
// invocation: in the 14:05 UTC run release.js sends too (1 clean-up batch of 2, 1 read, 1 update per account: at
// most 13 with its 10 accounts) and bonuses.js deletes (1), so with this module's 27 the run stays at 41. This module keeps to DB_MAX, counted as it goes: 1 select,
// up to LOOKUP_Q per fresh lookup (explore.js through lib: budgetCheck reads 2 rows for an invited account and none
// for the owner, spend and passOn write 1 each; a KV cache hit costs none), and SEND_Q per account (the claim, and
// giving it back when the mail fails). One account with 6 fresh airports always fits: 1 + 6 x 4 + 2 = 27.
const LOOKUP_Q = 4;
const SEND_Q = 2;
const DB_MAX = 27;
const CATCH_UP = 3;                  // a digest stays due for this many hours from its send hour
const SEARCH_DAYS = 60;               // a link searches tomorrow to tomorrow + 60
const TEST_LIMIT = [3, 3600];         // 寄一封給我看看: 3 an hour per account
const CODE = /^[A-Z]{3}$/;

// destination names, as the page's PLACES table writes them (zh, en); other codes show as the code alone
const NAMES = {
  TPE: ['台北桃園', 'Taipei Taoyuan'], TSA: ['台北松山', 'Taipei Songshan'], KHH: ['高雄', 'Kaohsiung'],
  RMQ: ['台中', 'Taichung'], SEA: ['西雅圖', 'Seattle'], SFO: ['舊金山', 'San Francisco'], SJC: ['聖荷西', 'San Jose'],
  OAK: ['奧克蘭（加州）', 'Oakland'], LAX: ['洛杉磯', 'Los Angeles'], ONT: ['安大略（加州）', 'Ontario'],
  SAN: ['聖地牙哥', 'San Diego'], PDX: ['波特蘭', 'Portland'], LAS: ['拉斯維加斯', 'Las Vegas'], PHX: ['鳳凰城', 'Phoenix'],
  DEN: ['丹佛', 'Denver'], SLC: ['鹽湖城', 'Salt Lake City'], DFW: ['達拉斯', 'Dallas'], IAH: ['休士頓', 'Houston'],
  ORD: ['芝加哥', 'Chicago'], MSP: ['明尼亞波利斯', 'Minneapolis'], DTW: ['底特律', 'Detroit'], ATL: ['亞特蘭大', 'Atlanta'],
  MIA: ['邁阿密', 'Miami'], MCO: ['奧蘭多', 'Orlando'], BOS: ['波士頓', 'Boston'], JFK: ['紐約甘迺迪', 'New York JFK'],
  EWR: ['紐華克', 'Newark'], LGA: ['紐約拉瓜地亞', 'LaGuardia'], IAD: ['華盛頓杜勒斯', 'Washington Dulles'],
  DCA: ['華盛頓雷根', 'Washington National'], HNL: ['檀香山', 'Honolulu'], ANC: ['安克拉治', 'Anchorage'],
  YVR: ['溫哥華', 'Vancouver'], YYZ: ['多倫多', 'Toronto'], YUL: ['蒙特婁', 'Montreal'], YYC: ['卡加利', 'Calgary'],
  MEX: ['墨西哥城', 'Mexico City'], NRT: ['東京成田', 'Tokyo Narita'], HND: ['東京羽田', 'Tokyo Haneda'],
  KIX: ['大阪關西', 'Osaka Kansai'], NGO: ['名古屋', 'Nagoya'], FUK: ['福岡', 'Fukuoka'], CTS: ['札幌', 'Sapporo'],
  OKA: ['沖繩', 'Okinawa'], ICN: ['首爾仁川', 'Seoul Incheon'], GMP: ['首爾金浦', 'Seoul Gimpo'], PUS: ['釜山', 'Busan'],
  HKG: ['香港', 'Hong Kong'], MFM: ['澳門', 'Macau'], PVG: ['上海浦東', 'Shanghai Pudong'],
  PEK: ['北京首都', 'Beijing Capital'], PKX: ['北京大興', 'Beijing Daxing'], CAN: ['廣州', 'Guangzhou'],
  XMN: ['廈門', 'Xiamen'], SIN: ['新加坡', 'Singapore'], BKK: ['曼谷', 'Bangkok'], KUL: ['吉隆坡', 'Kuala Lumpur'],
  MNL: ['馬尼拉', 'Manila'], SGN: ['胡志明市', 'Ho Chi Minh City'], HAN: ['河內', 'Hanoi'], DPS: ['峇里島', 'Bali'],
  DEL: ['德里', 'Delhi'], DXB: ['杜拜', 'Dubai'], DOH: ['杜哈', 'Doha'], AUH: ['阿布達比', 'Abu Dhabi'],
  IST: ['伊斯坦堡', 'Istanbul'], LHR: ['倫敦希斯洛', 'London Heathrow'], LGW: ['倫敦蓋威克', 'London Gatwick'],
  CDG: ['巴黎', 'Paris'], AMS: ['阿姆斯特丹', 'Amsterdam'], FRA: ['法蘭克福', 'Frankfurt'], MUC: ['慕尼黑', 'Munich'],
  ZRH: ['蘇黎世', 'Zurich'], VIE: ['維也納', 'Vienna'], FCO: ['羅馬', 'Rome'], MXP: ['米蘭', 'Milan'],
  MAD: ['馬德里', 'Madrid'], BCN: ['巴塞隆納', 'Barcelona'], LIS: ['里斯本', 'Lisbon'], DUB: ['都柏林', 'Dublin'],
  CPH: ['哥本哈根', 'Copenhagen'], ARN: ['斯德哥爾摩', 'Stockholm'], OSL: ['奧斯陸', 'Oslo'], HEL: ['赫爾辛基', 'Helsinki'],
  ATH: ['雅典', 'Athens'], PRG: ['布拉格', 'Prague'], SYD: ['雪梨', 'Sydney'], MEL: ['墨爾本', 'Melbourne'],
  BNE: ['布里斯本', 'Brisbane'], AKL: ['奧克蘭（紐西蘭）', 'Auckland'],
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WORDS = {
  zh: {
    from: '吉諾機票研究所', cab: { J: '商務艙', F: '頭等艙' }, sep: '、',
    date: d => +d.slice(5, 7) + '/' + +d.slice(8, 10),
    subject: (date, codes, cab, min, n) => `✈️ 每日精選 ${date}：${codes} 出發，${cab}直飛 ${min} 哩起` + (n ? `，${n} 個新的或降價` : ''),
    title: date => `✈️ 每日精選 ${date}`,
    intro: codes => `從 ${codes} 出發、直飛最便宜的目的地，每個機場和艙等列出前 ${TOP} 名：`,
    head: (code, place, cab) => `${code}${place ? ' ' + place : ''} 出發・${cab}`,
    miles: x => `${x} 哩`, fresh: '新', was: x => `降價，原本 ${x} 哩`,
    none: 'seats.aero 的快取裡沒有這個艙等的直飛價格。',
    failed: code => `今天查不到 ${code} 的資料，明天再看。`,
    first: '這是第一封。從下一封開始，會標出新出現和降價的目的地。',
    note: '這些是 seats.aero 快取裡看過的最低直飛價格，不限里程計畫和日期，可能已經沒有了。點目的地會在網站上搜尋明天起 60 天的位子；訂位前請到航空公司網站確認。',
    open: '打開網站', manage: '暫停或修改每日精選信',
  },
  en: {
    from: 'Gino’s Ticket Lab', cab: { J: 'Business', F: 'First' }, sep: ', ', low: { J: 'business', F: 'first' },
    date: d => MONTHS[+d.slice(5, 7) - 1] + ' ' + +d.slice(8, 10),
    subject: (date, codes, cab, min, n) => `✈️ Daily digest for ${date}: nonstop ${cab} from ${min} miles out of ${codes}` + (n ? `, ${n} new or cheaper` : ''),
    title: date => `✈️ Daily digest for ${date}`,
    intro: codes => `The cheapest nonstop destinations from ${codes}, the top ${TOP} for each airport and cabin:`,
    head: (code, place, cab) => `From ${code}${place ? ' (' + place + ')' : ''}: ${cab}`,
    miles: x => `${x} miles`, fresh: 'New', was: x => `was ${x}`,
    none: "No nonstop prices in this cabin in seats.aero's cache.",
    failed: code => `No data for ${code} today. It tries again tomorrow.`,
    first: 'This is your first digest. From the next one on, new and cheaper destinations are marked.',
    note: "These are the lowest nonstop prices seen in seats.aero's cache, on any program and date, so some may be gone. Each destination opens a search of the next 60 days on the site. Check with the airline before you book.",
    open: 'Open the site', manage: 'Pause or change the daily digest',
  },
};

/* ---------- dates and send hours ---------- */
const dayOf = at => new Date(at * 1000).toISOString().slice(0, 10);
const plusDays = (day, k) => new Date(Date.parse(day + 'T00:00:00Z') + k * 86400000).toISOString().slice(0, 10);
const nthSunday = (y, m, k) => { const w = new Date(Date.UTC(y, m, 1)).getUTCDay(); return Date.UTC(y, m, 1 + (7 - w) % 7 + 7 * (k - 1)); };
// 7 am in Seattle, in UTC hours, on this date: 14 on daylight time (second Sunday of March to the first Sunday of
// November; both switches happen at 2 am, before 7), else 15
function seattle7(day) {
  const y = +day.slice(0, 4), d = Date.parse(day + 'T00:00:00Z');
  return d >= nthSunday(y, 2, 2) && d < nthSunday(y, 10, 1) ? 14 : 15;
}
// the UTC hour a stored send hour starts on this date (Taiwan keeps UTC+8 all year)
const startHour = (hour, day) => (hour === 14 ? seattle7(day) : 0);
// the stored send hours due at this moment: their start hour or one of the CATCH_UP - 1 after it
function dueHours(at) {
  const day = dayOf(at), h = new Date(at * 1000).getUTCHours();
  return HOURS.filter(x => { const s = startHour(x, day); return h >= s && h < s + CATCH_UP; });
}
// the date where the account lives (Taiwan, UTC+8, for hour 0; Seattle, UTC-7 or -8, for hour 14): the email's
// title and its links' tomorrow. In the send windows it is the UTC date; a 寄一封給我看看 can come at any hour.
function localDay(hour, at) {
  if (hour !== 14) return dayOf(at + 8 * 3600);
  return dayOf(at - (seattle7(dayOf(at - 7 * 3600)) - 7) * 3600);
}

/* ---------- settings ---------- */
function cleanDigest(b) {
  if (!b || typeof b.on !== 'boolean' || !Array.isArray(b.airports) || !Array.isArray(b.cabins) || b.airports.length > 12 || b.cabins.length > 4) return null;
  const airports = [...new Set(b.airports.map(x => (typeof x === 'string' ? x.trim().toUpperCase() : '')))];
  if (!airports.length || !airports.every(x => CODE.test(x)) || airports.filter(x => !HOME.includes(x)).length > OTHERS_MAX) return null;
  if (!b.cabins.length || !b.cabins.every(k => CABS.includes(k))) return null;
  if (!HOURS.includes(b.hour)) return null;
  return { on: b.on, airports, cabins: CABS.filter(k => b.cabins.includes(k)), hour: b.hour, lang: b.lang === 'en' ? 'en' : 'zh' };
}
const out = g => ({
  on: g.enabled === 1, airports: g.airports.split(','), cabins: g.cabins.split(','), hour: g.hour, lang: g.lang, updated_at: g.updated_at,
  last_sent_day: g.last_sent_day, last_sent_at: g.last_sent_at, sent_count: g.sent_count, last_note: g.last_note,
});
// The snapshot holds, per airport and cabin, every destination the last digest saw as one string, cheapest first:
// ",CAN14780,HGH14780,HKG14780," (codes are 3 letters, miles are digits). Reading it is cheap (a few short strings,
// not thousands of keys), a lookup is one indexOf, and its first entries are that list's top.
const snapString = list => (list.length ? ',' + list.map(x => x.to + x.miles).join(',') + ',' : ',');
function priceIn(s, code) {
  const i = s.indexOf(',' + code);
  if (i < 0) return null;
  const j = s.indexOf(',', i + 4), v = +s.slice(i + 4, j < 0 ? s.length : j);
  return v > 0 ? v : null;   // a damaged entry counts as not there
}
function parseSnap(v) {
  try { const x = JSON.parse(v || '{}'); return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; } catch { return {}; }
}
const sectionOf = (snap, from, cab) => (snap[from] && typeof snap[from][cab] === 'string' ? snap[from][cab] : null);
// the last digest's top 3 for each airport and cabin still chosen (for the card; no lookup)
function lastPicks(g) {
  if (!g.snapshot) return [];
  const snap = parseSnap(g.snapshot), picks = [];
  for (const from of g.airports.split(',')) for (const cab of g.cabins.split(',')) {
    const s = sectionOf(snap, from, cab);
    if (s == null) continue;
    picks.push({ from, cab, top: s.split(',', 5).filter(Boolean).slice(0, 3).map(e => ({ to: e.slice(0, 3), miles: +e.slice(3) })) });
  }
  return picks;
}
async function allowed(env, s) {
  if (s.role === 'owner') return true;
  const u = await env.DB.prepare('SELECT alerts_ok FROM users WHERE id = ?').bind(s.id).first();
  return !!(u && u.alerts_ok === 1);
}

/* ---------- one digest ---------- */
// 12,000: lib.fmtN's toLocaleString makes a number formatter on every call (about 90 microseconds each, measured
// 2026-10-15), and an email can hold 120 rows, so this one is a regex (under 1 microsecond)
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// a number, or a numeric string such as '30,000' or '14780.5'; anything else is 0 (dropped)
const milesOf = v => {
  const x = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : NaN;
  return Number.isFinite(x) ? Math.round(x) : 0;
};
// each given cabin's destinations from one airport, cheapest first (ties by code), in one pass; values under
// 1,000 are dropped, and a destination listed twice keeps its lower price
function rank(dests, cabins, from) {
  const best = cabins.map(() => new Map());
  for (const d of Array.isArray(dests) ? dests : []) {
    if (!d || typeof d.airport !== 'string' || d.airport.length !== 3) continue;
    const to = d.airport.toUpperCase();
    if (!CODE.test(to) || to === from) continue;
    for (let i = 0; i < cabins.length; i++) {
      const m = milesOf(d[FIELD[cabins[i]]]);
      if (m >= MIN_MILES && m < 1e7 && !(best[i].get(to) <= m)) best[i].set(to, m);
    }
  }
  return best.map(b => Array.from(b, ([to, miles]) => ({ to, miles })).sort((x, y) => x.miles - y.miles || (x.to < y.to ? -1 : 1)));
}
// against the last snapshot string of this airport and cabin: new (not there) or cheaper (was = the old price);
// with no snapshot yet (the first digest, or a newly chosen airport or cabin) nothing is marked
const mark = (rows, prev) => rows.map(x => {
  const was = prev == null ? null : priceIn(prev, x.to);
  return { ...x, fresh: prev != null && was == null, was: was != null && x.miles < was ? was : null };
});
// the lib explore.js gets for one lookup: the same, but it adds the D1 queries of budgetCheck, spend and passOn to
// q.used as they happen, and notes whether a seats.aero call was spent
function metered(lib, q, note) {
  return {
    ...lib,
    budgetCheck: (env, s, h, cost) => { if (s && s.role !== 'owner') q.used += 2; return lib.budgetCheck(env, s, h, cost); },
    spend: (env, ctx, s, n) => { if (n) { q.used++; note.spent = true; } return lib.spend(env, ctx, s, n); },
    passOn: (r, env, h, ctx) => { q.used++; return lib.passOn(r, env, h, ctx); },
  };
}
// one airport's lookup, ranked for both cabins; kept in memo for the rest of the run, so accounts sharing an
// airport share the call and the ranking. null = no data. A lookup that spent a call and brought nothing failed at
// seats.aero, the same for every account, so that null is kept too; one that spent nothing was refused by the
// account's budget (or the network failed), and the next account may try it. cap (the run's limits) = { left: fresh
// lookups that may still bring data, tries: lookups that may still be tried, used: D1 queries so far }; null for
// 寄一封給我看看. (No run-wide stop after failures: one account's codes that seats.aero refuses would stop everyone.)
async function lookup(env, ctx, lib, from, s, memo, cap) {
  if (memo.has(from)) return memo.get(from);
  if (cap) cap.tries--;
  const note = { spent: false };
  let res = null;
  try { res = await getDestinations(env, ctx, metered(lib, cap || { used: 0 }, note), 'from', from, s); } catch (e) { console.error('digest lookup', from, e && e.message); }
  if (!res || !Array.isArray(res.destinations)) {
    if (note.spent) memo.set(from, null);
    return null;
  }
  if (cap) cap.left--;
  const [J, F] = rank(res.destinations, CABS, from);
  const entry = { J: { list: J, snap: null }, F: { list: F, snap: null } };
  memo.set(from, entry);
  return entry;
}
// the sections of one account's digest (g = a digests row plus email, role, daily_limit); cap = what the run has
// left (see lookup; null = no cap). Returns { deferred } when this account's lookups, or its worst case of D1
// queries, no longer fit in the run. An account has at most 6 airports, so the first one of a run always fits.
async function collect(env, ctx, lib, g, memo, cap) {
  const airports = g.airports.split(',').filter(c => CODE.test(c)), cabins = g.cabins.split(',').filter(k => CABS.includes(k));
  const fresh = airports.filter(c => !memo.has(c)).length;
  if (cap && (fresh > cap.left || fresh > cap.tries || cap.used + fresh * LOOKUP_Q + SEND_Q > DB_MAX)) return { deferred: true };
  const s = { id: g.user_id, role: g.role, daily_limit: g.daily_limit };
  const snap = parseSnap(g.snapshot), next = {}, sections = [], failed = [];
  for (const from of airports) {
    const entry = await lookup(env, ctx, lib, from, s, memo, cap);
    if (!entry) {   // keep what the last digest saw for this airport
      failed.push(from);
      if (snap[from]) next[from] = snap[from];
      continue;
    }
    next[from] = {};
    for (const cab of cabins) {
      const sec = entry[cab], prev = sectionOf(snap, from, cab);
      if (sec.snap == null) sec.snap = snapString(sec.list);
      sections.push({ from, cab, count: sec.list.length, first: prev == null, rows: mark(sec.list.slice(0, TOP), prev) });
      next[from][cab] = sec.snap;
    }
  }
  return { airports, sections, failed, next, rows: sections.reduce((n, x) => n + x.rows.length, 0) };
}

// the email of one digest: subject, plain text and HTML in the alert emails' look (c = what collect returned).
// Codes are checked 3-letter codes, miles digits and NAMES plain text, so only the site URL and the words need escaping.
function buildMail(env, lib, g, c, day) {
  const en = g.lang === 'en', L = en ? WORDS.en : WORDS.zh, site = env.SITE_URL || 'https://award.ginochang.com/';
  const s1 = plusDays(day, 1), s2 = plusDays(day, 1 + SEARCH_DAYS), esc = lib.escHtml;
  const link = (from, to, cab) => site + '#/s?o=' + from + '&d=' + to + '&s=' + s1 + '&e=' + s2 + '&c=' + cab;
  const place = code => (NAMES[code] ? NAMES[code][en ? 1 : 0] : '');
  const shown = c.sections.filter(x => x.rows.length);
  const cab0 = CABS.find(k => shown.some(x => x.cab === k));
  const min = Math.min(...shown.filter(x => x.cab === cab0).map(x => x.rows[0].miles));
  const codes = c.airports.filter(a => shown.some(x => x.from === a)).join(L.sep);
  const marked = c.sections.reduce((n, x) => n + x.rows.filter(r => r.fresh || r.was).length, 0);
  // "the first one" only when nothing could be compared (a newly added airport or cabin is just left unmarked)
  const date = L.date(day), firstTime = c.sections.length > 0 && c.sections.every(x => x.first);
  const subject = L.subject(date, codes, (L.low || L.cab)[cab0], fmt(min), marked);
  const intro = L.intro(codes);
  const tagOf = r => (r.fresh ? L.fresh : r.was ? L.was(fmt(r.was)) : '');
  // plain text
  const text = [L.title(date), intro, ...(firstTime ? ['', L.first] : [])];
  for (const x of c.sections) {
    text.push('', L.head(x.from, place(x.from), L.cab[x.cab]));
    if (!x.rows.length) text.push('  ' + L.none);
    for (const r of x.rows) text.push('  ' + [r.to + (place(r.to) ? ' ' + place(r.to) : ''), L.miles(fmt(r.miles)), tagOf(r)].filter(Boolean).join('  '), '    ' + link(x.from, r.to, x.cab));
  }
  for (const code of c.failed) text.push('', L.failed(code));
  text.push('', L.note, '', L.open + ': ' + site, L.manage + ': ' + site + '#/alerts');
  // HTML: one table per airport and cabin; a row is the destination, its miles and its mark, all linking to the search
  const ink = '#3E3A39', soft = '#6B6461', red = '#A33A2A', siteE = esc(site);
  const hrefOf = (from, to, cab) => siteE + '#/s?o=' + from + '&amp;d=' + to + '&amp;s=' + s1 + '&amp;e=' + s2 + '&amp;c=' + cab;
  const cell = 'padding:7px 4px;border-top:1px dashed ' + ink + ';vertical-align:top';
  const td = '<td style="' + cell + '">', tdR = '<td style="' + cell + ';text-align:right;white-space:nowrap">';
  const tagNew = ' <span style="display:inline-block;border:2px solid ' + ink + ';border-radius:999px;background:#F6D27A;padding:0 7px;font-size:12px;line-height:18px;white-space:nowrap">' + esc(L.fresh) + '</span>';
  const wasOpen = '<div style="color:' + red + ';font-size:13px;white-space:nowrap">';
  const rowHtml = (x, r) => {
    const a = '<a href="' + hrefOf(x.from, r.to, x.cab) + '" style="color:' + ink + ';text-decoration:none">', p = place(r.to);
    return '<tr>' + td + a + '<b style="letter-spacing:.5px">' + r.to + '</b>' + (p ? ' <span style="color:' + soft + '">' + p + '</span>' : '') + '</a>' +
      (r.fresh ? tagNew : '') + (r.was ? wasOpen + L.was(fmt(r.was)) + '</div>' : '') + '</td>' + tdR + a + '<b>' + L.miles(fmt(r.miles)) + '</b></a></td></tr>';
  };
  const sectionHtml = x => '<div style="font-size:16px;font-weight:bold;margin:16px 0 4px">' + esc(L.head(x.from, place(x.from), L.cab[x.cab])) + '</div>' +
    (x.rows.length ? '<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.45">' + x.rows.map(r => rowHtml(x, r)).join('') + '</table>'
      : '<p style="margin:0;font-size:14px;color:' + soft + '">' + esc(L.none) + '</p>');
  const html = '<div style="background:#FFFCF6;padding:16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'PingFang TC\',\'Noto Sans TC\',sans-serif;color:' + ink + '">' +
    '<div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:3px solid ' + ink + ';border-radius:18px;padding:18px 18px 14px">' +
    '<div style="font-size:20px;font-weight:bold;margin:0 0 6px">' + esc(L.title(date)) + '</div>' +
    '<p style="margin:0;font-size:15px;line-height:1.5">' + esc(intro) + '</p>' +
    (firstTime ? '<p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:' + soft + '">' + esc(L.first) + '</p>' : '') +
    c.sections.map(sectionHtml).join('') +
    c.failed.map(code => '<p style="margin:12px 0 0;font-size:14px;color:' + red + '">' + esc(L.failed(code)) + '</p>').join('') +
    '<p style="margin:16px 0 10px"><a href="' + esc(site) + '" style="display:inline-block;background:#F2A497;color:' + ink + ';border:3px solid ' + ink + ';border-radius:999px;padding:8px 18px;text-decoration:none;font-weight:bold">' + esc(L.open) + '</a></p>' +
    '<p style="margin:0;font-size:12px;line-height:1.5;color:' + soft + '">' + esc(L.note) + '<br><a href="' + esc(site + '#/alerts') + '" style="color:' + ink + '">' + esc(L.manage) + '</a></p>' +
    '</div></div>';
  return { from: L.from, subject, text: text.join('\n'), html };
}

/* ---------- the hourly cron ---------- */
export async function hourly({ env, ctx, lib, at }) {
  const hours = dueHours(at);
  if (!hours.length) return { due: 0 };
  const day = dayOf(at);
  // the start of the send window open now: an account tried since then (no data, or its email failed) goes after
  // the accounts not tried yet, then the ones sent longest ago (never sent first)
  const since = Date.parse(day + 'T00:00:00Z') / 1000 + Math.min(...hours.map(x => startHour(x, day))) * 3600;
  const due = await env.DB.prepare(
    'SELECT g.*, u.email, u.role, u.daily_limit FROM digests g JOIN users u ON u.id = g.user_id ' +
    'WHERE g.enabled = 1 AND g.hour IN (' + hours.map(() => '?').join(', ') + ') AND (g.last_sent_day IS NULL OR g.last_sent_day != ?) ' +
    "AND u.status = 'active' AND u.mail_verified_at IS NOT NULL AND (u.alerts_ok = 1 OR u.role = 'owner') " +
    'ORDER BY COALESCE(g.last_try_at, 0) >= ?, g.last_sent_day IS NOT NULL, g.last_sent_day, g.user_id LIMIT ?')
    .bind(...hours, day, since, PER_RUN).all();
  const memo = new Map(), cap = { left: LOOKUPS_PER_RUN, tries: TRIES_PER_RUN, used: 1 }, ran = [];
  for (const g of due.results) {
    try {
      ran.push(await sendOne(env, ctx, lib, g, memo, cap, day, at));
    } catch (e) {   // a D1 error on one account: log it and go on (no email went out unless the day was claimed)
      console.error('digest', g.user_id, e && e.message);
      ran.push({ user: g.user_id, note: 'error' });
    }
  }
  return { due: due.results.length, ran, queries: cap.used };
}
// one due account: collect, then claim the day, then send (or give the day back). day = the UTC date (the claim);
// the email is dated where the account lives, which in the send windows is the same date.
async function sendOne(env, ctx, lib, g, memo, cap, day, at) {
  const c = await collect(env, ctx, lib, g, memo, cap);
  if (c.deferred) return { user: g.user_id, note: 'next_run' };   // not tried: first in line next hour
  cap.used++;   // the claim, or the update below
  if (!c.rows) {
    // every lookup worked and nothing was cheap enough to list: done for today, and the snapshot stays the one
    // the last email showed; a failed lookup: try again next hour
    const empty = !c.failed.length;
    await env.DB.prepare('UPDATE digests SET last_note = ?, last_try_at = ?' + (empty ? ', last_sent_day = ?' : '') + ' WHERE user_id = ?')
      .bind(empty ? 'empty' : 'unavailable', at, ...(empty ? [day] : []), g.user_id).run();
    return { user: g.user_id, note: empty ? 'empty' : 'unavailable' };
  }
  const m = buildMail(env, lib, g, c, localDay(g.hour, at));
  // claim the day first: a second run at the same time, or a failed write after sending, cannot send it twice
  const claim = await env.DB.prepare('UPDATE digests SET snapshot = ?, last_sent_day = ?, last_sent_at = ?, sent_count = sent_count + 1, last_note = ?, last_try_at = ? ' +
    'WHERE user_id = ? AND (last_sent_day IS NULL OR last_sent_day != ?)')
    .bind(JSON.stringify(c.next), day, at, c.failed.length ? 'partial' : null, at, g.user_id, day).run();
  if (!claim || !claim.meta || claim.meta.changes !== 1) return { user: g.user_id, note: 'taken' };
  try {
    await lib.sendMail(env, g.email, m.from, m.subject, m.text, m.html);
  } catch (e) {
    console.error('digest mail', e && e.message);
    // not sent: the last email's record and snapshot back, and the day open again for the next hour
    cap.used++;
    await env.DB.prepare("UPDATE digests SET snapshot = ?, last_sent_day = ?, last_sent_at = ?, sent_count = MAX(0, sent_count - 1), last_note = 'mail_failed' WHERE user_id = ?")
      .bind(g.snapshot, g.last_sent_day, g.last_sent_at, g.user_id).run();
    return { user: g.user_id, note: 'mail_failed' };
  }
  return { user: g.user_id, mailed: true, rows: c.rows, failed: c.failed };
}

/* ---------- routes ---------- */
const ROW = 'SELECT * FROM digests WHERE user_id = ?';
export const routes = [
  {
    method: 'GET', path: '/me/digest', auth: 'user',
    handler: async ({ env, s, h, lib }) => {
      const g = await env.DB.prepare(ROW).bind(s.id).first();
      return lib.json({ digest: g ? out(g) : null, last: g ? lastPicks(g) : [], allowed: await allowed(env, s), home: HOME, others_max: OTHERS_MAX }, 200, h);
    },
  },
  {
    method: 'PUT', path: '/me/digest', auth: 'user',
    handler: async ({ req, env, s, h, lib }) => {
      if (!(await allowed(env, s))) return lib.json({ error: 'alerts_off' }, 403, h);
      const d = cleanDigest(await lib.readJson(req));
      if (!d) return lib.json({ error: 'param' }, 400, h);
      const t = lib.now();
      await env.DB.prepare('INSERT INTO digests (user_id, enabled, airports, cabins, hour, lang, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, airports = excluded.airports, cabins = excluded.cabins, hour = excluded.hour, ' +
        'lang = excluded.lang, updated_at = excluded.updated_at')
        .bind(s.id, d.on ? 1 : 0, d.airports.join(','), d.cabins.join(','), d.hour, d.lang, t, t).run();
      const g = await env.DB.prepare(ROW).bind(s.id).first();
      return lib.json({ ok: true, digest: out(g), last: lastPicks(g) }, 200, h);
    },
  },
  {
    // 寄一封給我看看: the digest of the saved settings, now (on or off). A verified address gets the email, and its
    // snapshot becomes the one the next digest compares against; otherwise only the preview comes back. The
    // scheduled one still goes out today. About 1 seats.aero call per airport.
    method: 'POST', path: '/me/digest/test', auth: 'user',
    handler: async ({ env, ctx, s, h, lib }) => {
      if (!(await allowed(env, s))) return lib.json({ error: 'alerts_off' }, 403, h);
      const key = 'rl:digest:' + s.id;
      if (await lib.tooMany(env, key, TEST_LIMIT)) return lib.json({ error: 'rate' }, 429, h);
      const g = await env.DB.prepare('SELECT g.*, u.email, u.role, u.daily_limit, u.mail_verified_at FROM digests g JOIN users u ON u.id = g.user_id WHERE g.user_id = ?').bind(s.id).first();
      if (!g) return lib.json({ error: 'not_found' }, 404, h);
      await lib.bump(env, key, TEST_LIMIT);
      const at = lib.now(), c = await collect(env, ctx, lib, g, new Map(), null);
      const preview = c.sections.map(x => ({ from: x.from, cab: x.cab, count: x.count, top: x.rows.slice(0, 3).map(r => ({ to: r.to, miles: r.miles })) }));
      const answer = extra => lib.json({ failed: c.failed, preview, ...extra }, 200, h);
      if (!c.rows) return answer({ mailed: false, note: c.failed.length ? 'unavailable' : 'empty', digest: out(g) });
      if (!g.mail_verified_at) return answer({ mailed: false, note: 'unverified', digest: out(g) });
      const m = buildMail(env, lib, g, c, localDay(g.hour, at));   // today where the account lives, not the UTC date
      try { await lib.sendMail(env, g.email, m.from, m.subject, m.text, m.html); } catch (e) { console.error('digest mail', e && e.message); return lib.json({ error: 'mail_failed' }, 502, h); }
      await env.DB.prepare('UPDATE digests SET snapshot = ?, last_sent_at = ?, sent_count = sent_count + 1, last_note = ? WHERE user_id = ?')
        .bind(JSON.stringify(c.next), at, c.failed.length ? 'partial' : null, s.id).run();
      const g2 = await env.DB.prepare(ROW).bind(s.id).first();
      return answer({ mailed: true, to: g.email, digest: out(g2), last: lastPicks(g2) });
    },
  },
];

export function onDeleteUser(env, uid) {
  return env.DB.prepare('DELETE FROM digests WHERE user_id = ?').bind(uid);
}

// for the Node tests in .claude/tmp/award-search/work/digest (not used by the Worker)
export const _test = { rank, mark, milesOf, snapString, priceIn, dueHours, startHour, seattle7, localDay, cleanDigest, buildMail, collect, lastPicks, NAMES, WORDS, DB_MAX };
