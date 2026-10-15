// features/explore.js: 探索 (Explore), 2026-10-15. Two parts, switched by the buttons at the top:
//   直飛目的地  every nonstop destination from one airport (or every airport flying nonstop to it), with the lowest
//               miles per cabin that seats.aero's cache has seen, any program and any date. GET /explore/destinations;
//               the Worker keeps each answer 6 hours, so asking again, from any device, costs no call.
//   計畫瀏覽    one program and cabin between two seats.aero regions over up to 60 days, grouped by route.
//               GET /explore/availability: 1 call per 1,000 rows, sent in date order; 載入更多 asks for the next 1,000.
// A tap on a destination, or 搜尋這條 under a route, fills the main search form and runs it.
(() => {
'use strict';

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const AP = /^[A-Z]{3}$/, DAYRE = /^\d{4}-\d{2}-\d{2}$/;
// seats.aero's region names, and the words the page shows for them
const REGIONS = [['North America', '北美'], ['South America', '南美'], ['Africa', '非洲'], ['Asia', '亞洲'], ['Europe', '歐洲'], ['Oceania', '大洋洲']];
const REGION_ZH = Object.fromEntries(REGIONS);
const QUICK = ['TPE', 'TSA', 'SEA'];
const SPAN = 60;                 // the longest browse: days from its first date to its last
const DEST_LIFE = 3 * 3600e3;    // this device reuses a destinations answer this long (the Worker keeps it 6 hours)
const BROWSE_LIFE = 30 * 60e3;   // and a browse this long (every page of one is a real call)
const STEP = 50;                 // routes drawn at a time
const CHIPS = 40;                // airport chips per row, the busiest first
const K_PREFS = 'award-explore', K_DEST = 'award-explore-d', K_BROWSE = 'award-explore-b';

const todayIso = () => isoDate(new Date());
const plus = (iso, k) => { const d = parseDate(iso); d.setDate(d.getDate() + k); return isoDate(d); };
// the latest date a browse may ask for: the Worker refuses an end after UTC today + 400, and here (Taiwan before
// 08:00, any zone ahead of UTC) the local day can be a day ahead of UTC's, so one day less is always accepted
const lastDay = () => plus(todayIso(), 399);
const earlier = (a, b) => (a < b ? a : b);
const dayLabel = iso => t('{0} ({1})', md(iso), WD[parseDate(iso).getDay()]);
// the same date for a sentence shown as plain text (a toast): mdw() would bring its number markup along
const dayText = iso => t('{0}（{1}）', md(iso), WD[parseDate(iso).getDay()]);
const cabApi = k => CABIN_BY[k].api;
const milesOf = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
const taxText = (minor, cur) => { const v = inDisp(minor, cur); return v == null ? money(minor / 100, cur || 'USD') : money(v, DISP()); };
const byId = id => document.getElementById(id);
const skel = k => '<div class="skel"></div>'.repeat(k);
const CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';

/* ---------- what is remembered on this device ---------- */
const P = Object.assign({ mode: 'dest', dir: 'from', ap: '', sort: '', prog: 'aeroplan', cab: '', or: 'North America', dr: 'Asia', s: '', e: '' }, load(K_PREFS, {}));
if (P.mode !== 'browse') P.mode = 'dest';
if (P.dir !== 'to') P.dir = 'from';
if (!AP.test(String(P.ap))) P.ap = '';
for (const k of ['sort', 'cab']) if (!own(CABIN_BY, P[k])) P[k] = own(CABIN_BY, S.prefs.cabin) ? S.prefs.cabin : 'J';
if (!own(PROGRAMS, P.prog)) P.prog = 'aeroplan';
if (!own(REGION_ZH, P.or)) P.or = 'North America';
if (!own(REGION_ZH, P.dr)) P.dr = 'Asia';
const saveP = () => save(K_PREFS, P);
// the browse dates: the ones picked while they still make sense (pulled inside today to lastDay() and 60 days),
// otherwise a week from today for 30 days
function range() {
  const td = todayIso(), last = lastDay();
  let s = String(P.s), e = String(P.e);
  if (!DAYRE.test(s) || !DAYRE.test(e) || e < td || e < s) return [plus(td, 7), plus(td, 37)];
  if (s < td) s = td;
  s = earlier(s, last); e = earlier(e, last);
  if (daysBetween(s, e) > SPAN) e = plus(s, SPAN);
  return [s, e];
}

/* ---------- 直飛目的地 ---------- */
let D = null;          // the list on screen: { key, kind, code, list }, or the same with loading or err instead of list
let typed = null;      // what is in the airport box but not looked up yet, kept over a redraw
let pickCodes = null;  // the airports of a typed place that has several, offered as chips
let pickFor = '';      // and the words typed for that place (the question above the chips is redrawn with it)
const destMem = new Map();
function destGet(key) {
  const all = load(K_DEST, {}), v = destMem.get(key) || (all && typeof all === 'object' ? all[key] : null);
  return v && Date.now() - v.t < DEST_LIFE && v.d && Array.isArray(v.d.destinations) ? v : null;
}
function destPut(key, d) {
  const v = { t: Date.now(), d }, all = load(K_DEST, {});
  destMem.set(key, v);
  const keep = Object.entries(Object.assign(all && typeof all === 'object' ? all : {}, { [key]: v }))
    .filter(([, x]) => x && Date.now() - x.t < DEST_LIFE).sort((a, b) => b[1].t - a[1].t).slice(0, 6);
  save(K_DEST, Object.fromEntries(keep));
}
async function lookDest(code, reveal) {
  const kind = P.dir, key = kind + ':' + code;
  P.ap = code; saveP(); typed = null; pickCodes = null;
  if (D && D.loading && D.key === key) return;
  const hit = destGet(key);
  if (hit) { D = { key, kind, code, list: hit.d.destinations }; drawDest(reveal); return; }
  D = { key, kind, code, loading: true };
  drawDest(reveal);
  let next;
  try {
    const d = await api('/explore/destinations?' + kind + '=' + code);
    if (!d || !Array.isArray(d.destinations)) throw new Error(t('seats.aero 沒有回傳目的地清單，等一下再試。'));
    destPut(key, d);
    next = { key, kind, code, list: d.destinations };
  } catch (err) {
    next = { key, kind, code, err: errOf(err) };
  }
  if (D && D.key === key && D.loading) { D = next; drawDest(false); }
}
// the list for one airport and direction from this device's cache only, or null: opening the page, coming back to
// 直飛目的地 and flipping the direction never call; a call waits for a tap on 查直飛 or an airport chip
function cachedDest(kind, code) {
  const key = kind + ':' + code, hit = AP.test(code) ? destGet(key) : null;
  return hit ? { key, kind, code, list: hit.d.destinations } : null;
}
function cleanDest(list) {
  const seen = new Set(), out = [];
  for (const x of Array.isArray(list) ? list : []) {
    if (!x || !AP.test(x.airport) || seen.has(x.airport)) continue;
    seen.add(x.airport);
    out.push({ airport: x.airport, economy: milesOf(x.economy), premium: milesOf(x.premium), business: milesOf(x.business), first: milesOf(x.first) });
  }
  return out;
}
// what the airport box would look up: the airport names, as under the main search's boxes
function apHint(v) {
  if (!v || !String(v).trim()) return '';
  const r = resolve(String(v));
  return r.err ? '' : r.codes.map(c => AIRPORT_ZH[c] || c).join(t('、'));
}
const pickHtml = () => (pickCodes || []).map(c => '<button type="button" class="chip" data-pick="' + esc(c) + '">' + esc(c) + (AIRPORT_ZH[c] ? '<small>' + esc(AIRPORT_ZH[c]) + '</small>' : '') + '</button>').join('');
function destForm() {
  const v = typed != null ? typed : P.ap, cur = D ? D.code : P.ap;
  return '<form class="acard w explore-form" id="explore-df" novalidate>' +
    '<div class="seg two explore-dir" role="radiogroup" aria-label="' + t('方向') + '">' +
      [['from', t('從這裡出發')], ['to', t('飛到這裡')]].map(([d, x]) => '<button type="button" role="radio" data-dir="' + d + '" aria-checked="' + (P.dir === d) + '">' + x + '</button>').join('') + '</div>' +
    '<div class="explore-aprow"><div class="field explore-ap"><label for="explore-ap">' + t('機場') + '</label>' +
      '<input id="explore-ap" value="' + esc(v) + '" placeholder="' + t('例：TPE') + '" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="search">' +
      '<div class="names" id="explore-apn">' + esc(apHint(v)) + '</div></div>' +
      '<button class="btn pri explore-go" type="submit">' + t('查直飛') + '</button></div>' +
    '<div class="chips explore-quick">' + QUICK.map(c => '<button type="button" class="chip" data-quick="' + c + '" aria-pressed="' + (cur === c) + '">' + c + '</button>').join('') + '</div>' +
    '<p class="msg bad" id="explore-dmsg" role="alert">' + (pickCodes ? esc(t('「{0}」有 {1} 個機場，請選一個：', pickFor, pickCodes.length)) : '') + '</p>' +
    '<div class="chips explore-pick" id="explore-pick">' + pickHtml() + '</div>' +
  '</form>';
}
const boardHead = k => '<div class="explore-bh"><span class="explore-bh0">' + t('依艙等排序') + '</span><span class="explore-cs" role="radiogroup" aria-label="' + t('依艙等排序') + '">' +
  CABINS.map(c => '<button type="button" class="chip" role="radio" data-sort="' + c.k + '" aria-checked="' + (c.k === k) + '">' + esc(c.name) + '</button>').join('') + '</span></div>';
function destRow(x, k) {
  const cells = CABINS.map(c => {
    const v = x[c.api], odd = v != null && v < 1000, cls = 'explore-c' + (c.k === k ? ' on' : '') + (v == null ? ' na' : odd ? ' odd' : '');
    // a number that looks wrong is grey, dotted and marked ?, and VoiceOver says so after the number
    return '<span class="' + cls + '"><span class="vh">' + esc(c.name) + '</span>' +
      (v == null ? '<span class="vh">' + t('沒有') + '</span><i aria-hidden="true">-</i>'
        : '<i>' + fmtMiles(v) + '</i>' + (odd ? '<sup aria-hidden="true">?</sup><span class="vh">' + t('看起來不對') + '</span>' : '')) + '</span>';
  }).join('');
  const nm = AIRPORT_ZH[x.airport];
  return '<button type="button" class="explore-dest" data-dest="' + esc(x.airport) + '"><span class="explore-dn"><b>' + esc(x.airport) + '</b>' +
    (nm ? '<span>' + esc(nm) + '</span>' : '') + '</span><span class="explore-cs">' + cells + '</span></button>';
}
function destOut() {
  if (!D) {
    // the remembered airport is still in the box (not looked up yet): say what 查直飛 will do for it
    const boxed = typed == null || typed.trim().toUpperCase() === P.ap ? P.ap : '';
    const say = boxed ? (P.dir === 'from' ? t('按「查直飛」，看 {0} 直飛哪些地方。', esc(boxed)) : t('按「查直飛」，看哪些機場直飛 {0}。', esc(boxed)))
      : P.dir === 'from' ? t('選一個機場，看它直飛哪些地方，還有各艙等最低要幾哩。') : t('選一個機場，看哪些機場直飛那裡，還有各艙等最低要幾哩。');
    return '<div class="empty">' + MASCOT + say + '</div>';
  }
  if (D.loading) return skel(4);
  if (D.err) return errBox(D.err, 'dest');
  const list = cleanDest(D.list), code = esc(D.code);
  if (!list.length) return '<div class="empty">' + MASCOT + t('seats.aero 沒有 {0} 的直飛資料，換個機場試試。', code) + '</div>';
  const k = P.sort, f = cabApi(k), from = D.kind === 'from';
  // the cabin picked, cheapest first; numbers under 1,000 look wrong, so they go after the real ones; no number last
  const rank = x => (x[f] == null ? 2 : x[f] < 1000 ? 1 : 0);
  list.sort((a, b) => rank(a) - rank(b) || (a[f] || 0) - (b[f] || 0) || (a.airport < b.airport ? -1 : 1));
  const odd = list.some(x => CABINS.some(c => x[c.api] != null && x[c.api] < 1000));
  // the code only: its city is already under the airport box, and a long name would break the heading on a phone
  const len = list.length;
  const head = from ? (len === 1 ? t('從 {0} 直飛：1 個目的地', code) : t('從 {0} 直飛：{1} 個目的地', code, fmtMiles(len)))
    : (len === 1 ? t('直飛 {0}：1 個出發機場', code) : t('直飛 {0}：{1} 個出發機場', code, fmtMiles(len)));
  return '<div class="explore-head" id="explore-dhead"><h3>' + head + '</h3>' +
      '<p class="note0">' + t('數字是 seats.aero 快取裡看過最低的直飛里程：任何計畫、任何日期都算，現在不一定還有位子。不同計畫的 1 哩價值不同，不能直接比。') + '</p>' +
      (odd ? '<p class="note0 explore-oddnote">' + t('標 ? 的灰色數字不到 1,000 哩，看起來不對，可能是資料錯誤。') + '</p>' : '') +
      (list.every(x => x[f] == null) ? '<p class="note0 explore-nonenote">' + t('這些直飛航線在 seats.aero 都沒有{0}的紀錄。', esc(CABIN_BY[k].name)) + '</p>' : '') +
      '<p class="note0">' + (from ? t('點一個目的地，會在搜尋頁查明天起 60 天的{0}（約用 1 到 2 次額度）。', esc(CABIN_BY[k].name))
        : t('點一個機場，會在搜尋頁查明天起 60 天的{0}（約用 1 到 2 次額度）。', esc(CABIN_BY[k].name))) + '</p></div>' +
    '<p class="lbl explore-sortlbl">' + t('依艙等排序') + '</p>' +
    '<div class="explore-board">' + boardHead(k) + list.map(x => destRow(x, k)).join('') + '</div>';
}
function drawDest(reveal) {
  const out = byId('explore-dout');
  if (!out) return;
  out.innerHTML = destOut();
  const cur = D ? D.code : P.ap;
  for (const b of out.parentNode.querySelectorAll('[data-quick]')) b.setAttribute('aria-pressed', String(b.dataset.quick === cur));
  for (const b of out.parentNode.querySelectorAll('[data-dir]')) b.setAttribute('aria-checked', String(b.dataset.dir === P.dir));
  if (reveal) bringUp(out);
}
function openDest(other) {
  if (!D || !D.list || !AP.test(other)) return;
  const [o, d] = D.kind === 'from' ? [D.code, other] : [other, D.code], td = todayIso();
  goSearch(o, d, plus(td, 1), plus(td, 60), P.sort);
}

/* ---------- 計畫瀏覽 ---------- */
let B = null;            // the browse on screen (newBrowse)
let GROUPS = new Map();  // its routes as last drawn, by "SEA-NRT"
const browseMem = new Map();
const qKey = q => [q.prog, q.cab, q.or, q.dr, q.s, q.e].join('|');
const newBrowse = q => ({ q, k: qKey(q), rows: new Map(), raw: 0, hasMore: false, cursor: null, last: '', t: Date.now(),
  loading: false, err: null, fo: new Set(), fd: new Set(), open: new Set(), shown: STEP });
const dropBrowse = () => { try { localStorage.removeItem(K_BROWSE); } catch { /* storage off */ } };
function browseLoad() {
  const v = load(K_BROWSE, null), q = v && v.q;
  if (v == null) return null;
  // an old or broken copy is deleted, so its size does not sit in this site's storage
  if (!q || !Array.isArray(v.rows) || !(Date.now() - v.t < BROWSE_LIFE) ||
    !own(PROGRAMS, q.prog) || !own(CABIN_BY, q.cab) || !own(REGION_ZH, q.or) || !own(REGION_ZH, q.dr) || !DAYRE.test(q.s) || !DAYRE.test(q.e)) { dropBrowse(); return null; }
  const b = Object.assign(newBrowse(q), { raw: +v.raw || 0, hasMore: !!v.hasMore, cursor: v.cursor == null ? null : String(v.cursor), last: String(v.last || ''), t: v.t });
  for (const r of v.rows) if (r && r.id && AP.test(r.o) && AP.test(r.d) && DAYRE.test(r.date) && r.miles > 0) b.rows.set(r.id, r);
  return b;
}
// The browse is kept on this device only while it is small: a 1,000-row page is about 190 KB, and Safari gives a
// site about 5 MB for everything (search settings, recent searches, other pages), so past BROWSE_MAX characters it
// lives in memory only and a reload starts over.
const BROWSE_MAX = 500e3;
function browseStore(b) {
  let text = '';
  if (b.rows.size > 3000) { dropBrowse(); return; }   // well past the limit already: skip the work
  try { text = JSON.stringify({ q: b.q, t: b.t, raw: b.raw, hasMore: b.hasMore, cursor: b.cursor, last: b.last, rows: [...b.rows.values()] }); } catch { text = ''; }
  if (!text || text.length > BROWSE_MAX) { dropBrowse(); return; }
  try { localStorage.setItem(K_BROWSE, text); } catch { dropBrowse(); }
}
// one seats.aero row, kept small: only what the list shows, for the cabin browsed
function slim(r, k) {
  if (!r || !r[k + 'Available'] || !r.Route) return null;
  const m = num(r[k + 'MileageCost']), o = r.Route.OriginAirport, d = r.Route.DestinationAirport, date = String(r.Date || '').slice(0, 10);
  if (!m || !AP.test(o) || !AP.test(d) || !DAYRE.test(date) || r.ID == null) return null;
  return { id: String(r.ID), date, o, d, miles: m, seats: num(r[k + 'RemainingSeats']), direct: !!r[k + 'Direct'],
    air: String(r[k + 'Airlines'] || '').split(/[\s,]+/).filter(x => /^[A-Z0-9]{2}$/.test(x)).slice(0, 6),
    tax: num(r[k + 'TotalTaxes']), cur: /^[A-Z]{3}$/.test(r.TaxesCurrency || '') ? r.TaxesCurrency : '', upd: String(r.UpdatedAt || '') };
}
// a page of seats.aero's answer into the browse: rows de-duplicated by ID, and where the next page starts
function absorb(b, d) {
  const rows = d && Array.isArray(d.data) ? d.data : [];
  for (const r of rows) {
    const date = r && String(r.Date || '').slice(0, 10);
    if (DAYRE.test(date) && date > b.last) b.last = date;
    const x = slim(r, b.q.cab);
    if (x && !b.rows.has(x.id)) b.rows.set(x.id, x);
  }
  b.raw += rows.length;
  b.cursor = d && d.cursor != null ? String(d.cursor) : null;
  b.hasMore = !!(d && d.hasMore) && b.cursor != null && rows.length > 0;
}
function availPath(b) {
  const q = b.q, p = new URLSearchParams({ source: q.prog, cabin: cabApi(q.cab), origin_region: q.or, destination_region: q.dr, start_date: q.s, end_date: q.e });
  if (b.raw && b.cursor != null) { p.set('cursor', b.cursor); p.set('skip', String(b.raw)); }
  return '/explore/availability?' + p;
}
async function morePage(b, reveal) {
  if (b.loading) return;
  b.loading = true; b.err = null;
  if (B === b) drawBrowse(reveal);
  try {
    absorb(b, await api(availPath(b)));
    browseMem.set(b.k, b);
    browseStore(b);
  } catch (err) { b.err = errOf(err); }
  b.loading = false;
  if (B === b) drawBrowse(false);
}
function runBrowse() {
  const [s, e] = range();
  if (e < todayIso()) { setBmsg(t('這些日期已經過了。')); return; }
  setBmsg('');
  const q = { prog: P.prog, cab: P.cab, or: P.or, dr: P.dr, s, e }, k = qKey(q);
  if (B && B.k === k && B.loading) return;
  const stored = browseLoad(), old = browseMem.get(k) || (stored && stored.k === k ? stored : null);
  if (old && Date.now() - old.t < BROWSE_LIFE && old.raw) {   // the same browse a moment ago: no new call
    Object.assign(old, { fo: new Set(), fd: new Set(), open: new Set(), shown: STEP });
    B = old;
    drawBrowse(true);
    return;
  }
  B = newBrowse(q);
  morePage(B, true);
}
function groupRoutes(b) {
  const m = new Map();
  for (const r of b.rows.values()) {
    const k = r.o + '-' + r.d;
    let g = m.get(k);
    if (!g) m.set(k, g = { k, o: r.o, d: r.d, rows: [], min: Infinity });
    g.rows.push(r);
    if (r.miles < g.min) g.min = r.miles;
  }
  for (const g of m.values()) {
    g.rows.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.miles - y.miles));
    g.days = new Set(g.rows.map(r => r.date)).size;
    g.first = g.rows[0].date;
  }
  return m;
}
const regionText = q => esc(t(REGION_ZH[q.or])) + ' → ' + esc(t(REGION_ZH[q.dr]));
function chipRow(attr, label, counts, sel) {
  if (counts.size < 2 && !sel.size) return '';
  const items = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, CHIPS);
  for (const c of sel) if (!items.some(x => x[0] === c)) items.push([c, counts.get(c) || 0]);
  return '<div class="explore-ff"><span class="explore-fl">' + label + '</span><div class="explore-chips" role="group" aria-label="' + label + '">' +
    items.map(([c, k]) => '<button type="button" class="chip" data-' + attr + '="' + esc(c) + '" aria-pressed="' + sel.has(c) + '">' + esc(c) + '<small>' + k + '</small></button>').join('') + '</div></div>';
}
function routeRow(g) {
  const open = B.open.has(g.k), no = AIRPORT_ZH[g.o], nd = AIRPORT_ZH[g.d];
  return '<div class="explore-rt' + (open ? ' open' : '') + '"><button type="button" class="explore-rh" data-route="' + esc(g.k) + '" aria-expanded="' + open + '">' +
      '<span class="explore-r1"><b class="explore-rc">' + esc(g.o) + '<span class="ar">' + PLANE + '</span>' + esc(g.d) + '</b><span class="mi">' + fmtMiles(g.min) + '<small>' + t('哩') + '</small></span></span>' +
      (no || nd ? '<span class="explore-r2">' + esc(no || g.o) + ' → ' + esc(nd || g.d) + '</span>' : '') +
      '<span class="explore-r3"><span>' + (g.days === 1 ? t('1 天有位') : t('{0} 天有位', g.days)) + '</span><span>' + t('最早 {0}', mdw(g.first)) + '</span>' + CHEV + '</span>' +
    '</button>' + (open ? detailHtml(g) : '') + '</div>';
}
function detailHtml(g) {
  const day = r => '<li><span class="dd">' + mdw(r.date) + '</span><span class="dm">' + t('{0} 哩', fmtMiles(r.miles)) + '</span>' +
    (r.tax && !NO_TAX.has(B.q.prog) ? '<span class="dt">+ ' + esc(taxText(r.tax, r.cur)) + '</span>' : '') +
    '<small>' + [r.seats ? (r.seats === 1 ? t('剩 1 位') : t('剩 {0} 位', r.seats)) : '', r.direct ? t('直飛') : '',
      (r.air || []).map(c => '<span class="explore-air">' + logo(c) + esc(carrierName(c)) + '</span>').join('')].filter(Boolean).map(x => '<span>' + x + '</span>').join('') + '</small></li>';
  return '<div class="explore-rd"><ul class="explore-days">' + g.rows.map(day).join('') + '</ul>' +
    '<button type="button" class="btn pri explore-sr" data-sr="' + esc(g.k) + '">' + t('搜尋這條') + '</button>' +
    '<p class="note0">' + t('會在搜尋頁查 {0} 到 {1} 這條航線的所有計畫。', md(B.q.s), md(B.q.e)) + '</p></div>';
}
function moreBox() {
  return '<div class="banner explore-morebox"><b>' + t('還有更多結果') + '</b>' + t('seats.aero 依日期排序，目前載入到 {0}。', mdw(B.last || B.q.s)) +
    (B.err ? '<p class="msg bad">' + esc(errText(B.err)) + '</p>' : '') +
    '<div class="acts"><button type="button" class="btn pri explore-more" data-more="1"' + (B.loading ? ' disabled' : '') + '>' +
      (B.loading ? t('讀取中…') : t('載入更多（再用 1 次額度）')) + '</button></div></div>';
}
function browseOut() {
  if (!B) return '<div class="empty">' + MASCOT + t('選好計畫、艙等、地區和日期，按「搜尋」。') + '</div>';
  if (!B.raw && B.loading) return skel(4);
  if (!B.raw && B.err) return errBox(B.err, 'browse');
  const q = B.q;
  GROUPS = groupRoutes(B);
  const all = [...GROUPS.values()];
  let h = '<div class="explore-head" id="explore-bhead"><h3>' + esc(prog(q.prog).name) + ' ' + esc(CABIN_BY[q.cab].name) + '</h3>' +
    '<p class="note0">' + regionText(q) + '　' + t('{0} 到 {1}', md(q.s), md(q.e)) + '</p>';
  if (!all.length) return h + '</div>' + (B.hasMore ? moreBox() : '') + '<div class="empty">' + MASCOT + t('這段日期沒有找到位子。可以換個艙等、地區或日期再試。') + '</div>';
  const co = new Map(), cd = new Map();
  for (const g of all) { co.set(g.o, (co.get(g.o) || 0) + 1); cd.set(g.d, (cd.get(g.d) || 0) + 1); }
  const list = all.filter(g => (!B.fo.size || B.fo.has(g.o)) && (!B.fd.size || B.fd.has(g.d)))
    .sort((a, b) => a.min - b.min || b.days - a.days || (a.k < b.k ? -1 : 1));
  const ts = [...B.rows.values()].map(r => Date.parse(r.upd)).filter(Boolean);
  const age = x => ago(new Date(x).toISOString()).replace(t('更新'), '').trim();
  const filtered = B.fo.size || B.fd.size;
  h += '<p class="sum">' + (all.length === 1 ? t('1 條航線有位') : t('{0} 條航線有位', fmtMiles(all.length))) + (filtered ? t('，篩選後 {0} 條', fmtMiles(list.length)) : '') + '</p>' +
    (ts.length ? '<p class="fresh">' + t('資料更新：最新 {0}，最舊 {1}', age(Math.max(...ts)), age(Math.min(...ts))) + '</p>' : '') + '</div>';
  if (B.hasMore || (B.err && B.raw)) h += moreBox();
  h += chipRow('fo', t('出發'), co, B.fo) + chipRow('fd', t('抵達'), cd, B.fd) +
    (filtered ? '<button type="button" class="btn ghost explore-fclear" data-fclear="1">' + t('清除機場篩選') + '</button>' : '');
  if (!list.length) return h + '<p class="note0 explore-none">' + t('沒有符合這些機場的航線。') + '</p>';
  h += '<div class="explore-board explore-routes">' + list.slice(0, B.shown).map(routeRow).join('') + '</div>';
  if (list.length > B.shown) h += '<button type="button" class="more-btn explore-showmore" data-showmore="1">' + t('再顯示 {0} 條（還有 {1} 條）', Math.min(STEP, list.length - B.shown), fmtMiles(list.length - B.shown)) + '</button>';
  return h + '<p class="note0">' + t('里程是這個計畫在 seats.aero 快取裡的價格，訂位前請到航空公司網站確認。') + '</p>';
}
function drawBrowse(reveal) {
  const out = byId('explore-bout');
  if (!out) return;
  out.innerHTML = browseOut();
  if (reveal) bringUp(out);
}
function toggleRoute(btn) {
  const k = btn.dataset.route, g = GROUPS.get(k), box = btn.closest('.explore-rt');
  if (!g || !box || !B) return;
  const open = !B.open.has(k);
  if (open) B.open.add(k); else B.open.delete(k);
  btn.setAttribute('aria-expanded', String(open));
  box.classList.toggle('open', open);
  const old = box.querySelector('.explore-rd');
  if (old) old.remove();
  if (open) box.insertAdjacentHTML('beforeend', detailHtml(g));
}
const progInfo = k => { const p = prog(k), al = ALLIANCE_BY[p.al]; return esc([p.zh, al ? al.name : ''].filter(Boolean).join(t('、'))); };
function selField(id, label, value, options) {
  return '<div class="field explore-sel"><label for="' + id + '">' + label + '</label><span class="explore-sv" id="' + id + '-v">' + esc(value) + '</span>' +
    '<select id="' + id + '">' + options + '</select></div>';
}
const opt = (v, text, on) => '<option value="' + esc(v) + '"' + (on ? ' selected' : '') + '>' + esc(text) + '</option>';
function dateField(w, label, v) {
  return '<div class="field df"><label for="explore-' + w + '">' + label + '<small id="explore-' + w + '-y">' + parseDate(v).getFullYear() + '</small></label>' +
    '<span class="dv" id="explore-' + w + '-v">' + dayLabel(v) + '</span><input type="date" id="explore-' + w + '" value="' + v + '"></div>';
}
function browseForm() {
  const [s, e] = range();
  const progs = ALLIANCES.map(a => '<optgroup label="' + esc(a.name) + '">' +
    Object.keys(PROGRAMS).filter(k => PROGRAMS[k][2] === a.k).map(k => opt(k, prog(k).name, k === P.prog)).join('') + '</optgroup>').join('');
  const regions = w => REGIONS.map(([en, zh]) => opt(en, t(zh), P[w] === en)).join('');
  return '<form class="acard y explore-form" id="explore-bf" novalidate>' +
    selField('explore-prog', t('里程計畫'), prog(P.prog).name, progs) +
    '<p class="explore-pinfo" id="explore-pinfo">' + progInfo(P.prog) + '</p>' +
    '<div class="explore-cabs" role="radiogroup" aria-label="' + t('艙等') + '">' +
      CABINS.map(c => '<button type="button" class="chip" role="radio" data-bcab="' + c.k + '" aria-checked="' + (P.cab === c.k) + '">' + esc(c.name) + '</button>').join('') + '</div>' +
    '<div class="explore-two">' + selField('explore-or', t('出發地區'), t(REGION_ZH[P.or]), regions('or')) + selField('explore-dr', t('目的地區'), t(REGION_ZH[P.dr]), regions('dr')) + '</div>' +
    '<p class="note0">' + t('seats.aero 的「亞洲」也包含中東，例如杜拜、阿布達比、特拉維夫。') + '</p>' +
    '<div class="explore-dates">' + dateField('s', t('最早日期'), s) + '<span class="to" aria-hidden="true">' + t('到') + '</span>' + dateField('e', t('最晚日期'), e) + '</div>' +
    '<p class="note0">' + t('日期最多 60 天。每次搜尋用 1 次額度，最多 1,000 筆。') + '</p>' +
    '<p class="msg bad" id="explore-bmsg" role="alert"></p>' +
    '<button class="btn pri explore-bgo" type="submit">' + t('搜尋') + '</button></form>';
}
function syncForm() {
  const [s, e] = range(), td = todayIso();
  const set = (id, text) => { const el = byId(id); if (el) el.textContent = text; };
  set('explore-prog-v', prog(P.prog).name);
  const pi = byId('explore-pinfo');
  if (pi) pi.innerHTML = progInfo(P.prog);
  set('explore-or-v', t(REGION_ZH[P.or]));
  set('explore-dr-v', t(REGION_ZH[P.dr]));
  for (const [w, v] of [['s', s], ['e', e]]) {
    const inp = byId('explore-' + w);
    if (inp) inp.value = v;
    set('explore-' + w + '-v', dayLabel(v));
    set('explore-' + w + '-y', String(parseDate(v).getFullYear()));
  }
  const si = byId('explore-s'), ei = byId('explore-e'), last = lastDay();
  if (si) { si.min = td; si.max = last; }
  if (ei) { ei.min = s; ei.max = earlier(plus(s, SPAN), last); }
}
// a picked date; a last date before the first, more than 60 days after it, or past lastDay(), is moved and said so
function changeDate(w, v) {
  let [s, e] = range();
  const td = todayIso(), last = lastDay(), len = daysBetween(s, e);
  let note = '';
  if (DAYRE.test(v)) {
    if (w === 's') {
      s = v < td ? td : earlier(v, last);
      if (v > last) { e = last; note = t('最遠只能查到 {0}，兩個日期都已改成這一天。', dayText(last)); }
      else if (e < s || daysBetween(s, e) > SPAN) { e = earlier(plus(s, Math.min(Math.max(len, 0), SPAN)), last); note = t('最晚日期已跟著改成 {0}。', dayText(e)); }
    } else if (v < s) { e = s; note = t('最晚日期不能早於最早日期，已改成 {0}。', dayText(e)); }
    else {
      const cap = earlier(plus(s, SPAN), last);
      if (v <= cap) e = v;
      else if (cap === last) { e = last; note = t('最遠只能查到 {0}，最晚日期已改成這一天。', dayText(last)); }
      else { e = cap; note = t('日期最多 {0} 天，最晚日期已改成 {1}。', SPAN, dayText(e)); }
    }
  }
  P.s = s; P.e = e; saveP();
  syncForm();
  if (note) toast(note);
}

/* ---------- shared ---------- */
// A failed call is kept as the recipe of its words (the Chinese template and its values), not as the words, so a
// language switch redraws it in the new language. The templates are api()'s in index.html, plus this page's own.
// The reset time ({1} or {0} below, marked by its place) is worked out again at each draw, in the language then.
const API_MSGS = [
  ['你今天的 {0} 次額度用完了，{1}重置。', 1],
  ['今天整個網站的額度快用完了，剩下的先留給管理員，{0}重置。', 0],
  ['今天的 1,000 次查詢額度用完了，{0}重置。', 0],
  ['seats.aero 暫時有問題（HTTP {0}），等一下再試。'],
  ['seats.aero 不接受這把 API key（{0}），需要重新產生一把。'],
  ['搜尋條件的格式不對。'], ['連不上中繼站，請檢查網路後再試一次。'], ['seats.aero 回傳的資料看不懂，等一下再試。'],
  ['seats.aero 的 Pro 訂閱已經過期，續訂之後才查得到。'], ['seats.aero 沒有回傳目的地清單，等一下再試。'],
];
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function errOf(err) {
  const msg = String((err && err.message) || err || '');
  for (const [zh, reset] of API_MSGS) {
    const order = [];
    const re = new RegExp('^' + reEsc(t(zh)).replace(/\\\{(\d+)\\\}/g, (m, i) => { order.push(+i); return '([\\s\\S]*?)'; }) + '$');
    const hit = re.exec(msg);
    if (!hit) continue;
    const args = [];
    order.forEach((i, j) => { args[i] = hit[j + 1]; });
    return { zh, args, reset };
  }
  return { text: msg };   // words from somewhere else stay as they came
}
function errText(e) {
  if (!e) return '';
  if (!e.zh) return e.text;
  const a = e.args.slice();
  if (e.reset != null) a[e.reset] = resetText();
  return a.length ? t(e.zh, ...a) : t(e.zh);
}
const errBox = (e, which) => '<div class="banner bad"><b>' + t('查不到') + '</b>' + esc(errText(e)) +
  '<div class="acts"><button type="button" class="btn" data-retry="' + which + '">' + t('再試一次') + '</button></div></div>';
function setMsg2(id, text) { const el = byId(id); if (el) el.textContent = text || ''; }
// a redraw replaces the button that had keyboard focus; put focus on its new copy (Safari does not focus tapped buttons)
function refocus(sel) { const el = byId('explore-body').querySelector(sel); if (el) el.focus({ preventScroll: true }); }
const setDmsg = text => setMsg2('explore-dmsg', text), setBmsg = text => setMsg2('explore-bmsg', text);
// after a tap that loaded something below the form: bring its top up when it starts low on the screen
function bringUp(el) {
  const top = el.getBoundingClientRect().top;
  if (top > innerHeight * 0.55) el.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
}
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let backTo = null;   // where the list was scrolled when a tap went to the search page; restored on the way back
// fill the main search with one route, cabin and dates, and run it like the 搜尋 button
function goSearch(o, d, s, e, k) {
  backTo = scrollY;
  S.prefs.cabin = k;
  savePrefs();
  location.hash = '#/';
  route();
  fillForm({ o, d, s, e });
  const p = readForm();
  if (p) runSearch(p, false, true);
}
const modeSeg = () => '<div class="seg two explore-mode" role="radiogroup" aria-label="' + t('探索方式') + '">' +
  [['dest', t('直飛目的地')], ['browse', t('計畫瀏覽')]].map(([m, x]) => '<button type="button" role="radio" data-mode="' + m + '" aria-checked="' + (P.mode === m) + '">' + x + '</button>').join('') + '</div>';
function draw() {
  const el = byId('explore-body');
  if (!el) return;
  el.innerHTML = modeSeg() + (P.mode === 'dest' ? destForm() + '<div id="explore-dout">' + destOut() + '</div>'
    : browseForm() + '<div id="explore-bout">' + browseOut() + '</div>');
  if (P.mode === 'browse') syncForm();
}
function pickAirport(code) {
  const input = byId('explore-ap');
  if (input) input.value = code;
  setMsg2('explore-apn', apHint(code));
  setDmsg('');
  const pk = byId('explore-pick');
  if (pk) pk.innerHTML = '';
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  lookDest(code, true);
}

function onClick(e) {
  const date = e.target.closest('input[type=date]');
  if (date) { try { date.showPicker(); } catch { /* older Safari opens its own picker */ } return; }
  // a tap anywhere in the airport box (label, code or city line) goes to its input, as on the search form
  const apBox = e.target.closest('.explore-ap');
  if (apBox && e.target.tagName !== 'INPUT') { apBox.querySelector('input').focus(); return; }
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.mode) {
    if (P.mode === d.mode) return;
    P.mode = d.mode; saveP();
    if (P.mode === 'dest' && !D && P.ap) D = cachedDest(P.dir, P.ap);
    draw();
  } else if (d.dir) {
    if (P.dir === d.dir) return;
    // the list on screen went the other way: this way from the cache, or wait for 查直飛; the box keeps what is typed
    P.dir = d.dir; saveP();
    const code = D ? D.code : P.ap;
    D = code ? cachedDest(P.dir, code) : null;
    drawDest(false);
  } else if (d.quick || d.pick) pickAirport(d.quick || d.pick);
  else if (d.sort) {
    if (P.sort === d.sort) return;
    // re-sorted from deep in the list (the header is stuck under the top bar): start the new order at its top
    const board = b.closest('.explore-board'), bh = b.closest('.explore-bh');
    const inside = !!(board && bh) && bh.getBoundingClientRect().top > board.getBoundingClientRect().top + 1;
    const kept = document.activeElement === b;
    P.sort = d.sort; saveP(); drawDest(false);
    const nb = byId('explore-dout').querySelector('.explore-board');
    if (inside && nb) nb.scrollIntoView({ block: 'start' });
    if (kept) refocus('[data-sort="' + d.sort + '"]');
  }
  else if (d.dest) openDest(d.dest);
  else if (d.retry === 'dest') { if (D) lookDest(D.code, false); }
  else if (d.retry === 'browse') { if (B) { B = newBrowse(B.q); morePage(B, false); } }
  else if (d.bcab) { P.cab = d.bcab; saveP(); for (const x of b.parentNode.children) x.setAttribute('aria-checked', String(x === b)); }
  else if ((d.fo || d.fd) && B) {
    const set = d.fo ? B.fo : B.fd, c = d.fo || d.fd, kept = document.activeElement === b;
    if (set.has(c)) set.delete(c); else set.add(c);
    B.shown = STEP; drawBrowse(false);
    if (kept && AP.test(c)) refocus('[data-' + (d.fo ? 'fo' : 'fd') + '="' + c + '"]');
  } else if (d.fclear && B) { B.fo.clear(); B.fd.clear(); B.shown = STEP; drawBrowse(false); }
  else if (d.route) toggleRoute(b);
  else if (d.sr) { const g = GROUPS.get(d.sr); if (g && B) goSearch(g.o, g.d, B.q.s, B.q.e, B.q.cab); }
  else if (d.more) { if (B && B.hasMore) morePage(B, false); }
  else if (d.showmore && B) { B.shown += STEP; drawBrowse(false); }
}
function onSubmit(e) {
  e.preventDefault();
  if (e.target.id === 'explore-df') {
    const input = byId('explore-ap'), v = input.value.trim(), r = v ? resolve(v) : { codes: [] };
    pickCodes = null;
    const pk = byId('explore-pick');
    if (pk) pk.innerHTML = '';
    if (r.err) return setDmsg(r.err);
    if (!r.codes.length) return setDmsg(t('請輸入一個機場代號，例如 TPE。'));
    if (r.codes.length > 1) {
      pickCodes = r.codes; pickFor = v;
      setDmsg(t('「{0}」有 {1} 個機場，請選一個：', v, r.codes.length));
      if (pk) pk.innerHTML = pickHtml();
      return;
    }
    input.blur();
    setDmsg('');
    lookDest(r.codes[0], true);
  } else if (e.target.id === 'explore-bf') {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    runBrowse();
  }
}
function onChange(e) {
  const id = e.target.id, v = e.target.value;
  if (id === 'explore-prog' && own(PROGRAMS, v)) { P.prog = v; saveP(); syncForm(); }
  else if ((id === 'explore-or' || id === 'explore-dr') && own(REGION_ZH, v)) { P[id.slice(8)] = v; saveP(); syncForm(); }
  else if (id === 'explore-s' || id === 'explore-e') changeDate(id.slice(8), v);
}
function onInput(e) {
  if (e.target.id !== 'explore-ap') return;
  typed = e.target.value;
  setMsg2('explore-apn', apHint(typed));
  setDmsg('');
  // the question and chips were about the words before this edit
  if (pickCodes) { pickCodes = null; const pk = byId('explore-pick'); if (pk) pk.innerHTML = ''; }
}

addFeature({
  id: 'explore',
  title: '探索',
  route: '#/explore',
  back: '#/',
  nav: { tab: 'explore', order: 10, label: '探索',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#3E3A39" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><circle cx="12" cy="12" r="9.2" fill="#A8D3E6"/><path d="M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3z" fill="#F6D27A"/></g></svg>' },
  css: `
.explore-mode{margin:8px 0 12px}
.explore-mode button{min-height:44px;font-size:16px}
.explore-form{display:grid;gap:10px;margin-top:0}
.explore-form .note0{margin:0}
.explore-dir button{min-height:40px;font-size:15px}
.explore-dir button[aria-checked=true]{background:var(--water)}
.explore-aprow{display:flex;gap:8px;align-items:stretch}
.explore-aprow .field{flex:1;min-width:0}
.explore-ap{cursor:text}
.explore-ap input{font-size:clamp(18px,5.6vw,24px);line-height:1.3;text-transform:uppercase;letter-spacing:.5px}
.explore-ap input::placeholder{font-size:16px;letter-spacing:0;text-transform:none;color:#A39C98}
.explore-go{flex:0 0 auto;border-radius:16px;padding:0 14px;min-height:44px;font-size:16px;white-space:nowrap}
.explore-quick,.explore-pick{gap:8px}
.explore-pick:empty{display:none}
.explore-quick .chip,.explore-pick .chip{min-height:40px;padding:2px 16px;letter-spacing:.5px}
.explore-pick .chip small{font-size:12px;color:var(--ink2);letter-spacing:0}
.explore-head{margin:16px 2px 6px;scroll-margin-top:calc(var(--hh) + 8px)}
.explore-head h3{font-size:19px;line-height:1.4;margin:0 0 4px}
.explore-head .note0{margin:0 0 4px}
.explore-head .sum{margin:6px 0 0}
#explore-dout,#explore-bout{scroll-margin-top:calc(var(--hh) + 8px)}
.explore-sortlbl{margin:10px 2px 4px}
.explore-board{border:var(--line);border-radius:var(--r);background:var(--paper);overflow:hidden;overflow:clip;margin:4px 0 12px;scroll-margin-top:calc(var(--hh) + 6px)}
.explore-bh{position:sticky;top:var(--hh);z-index:3;background:var(--paper);border-bottom:2px solid var(--ink);padding:8px 10px;display:grid;grid-template-columns:minmax(0,1fr);align-items:center}
.explore-bh0{display:none;font-size:13px;color:var(--ink2)}
.explore-cs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.explore-bh .chip,.explore-cabs .chip{justify-content:center;min-height:40px;padding:2px;white-space:nowrap;font-size:15px}
.explore-bh .chip[aria-checked=true],.explore-cabs .chip[aria-checked=true]{background:var(--yellow)}
html[lang=en] .explore-bh .chip,html[lang=en] .explore-cabs .chip{font-size:clamp(11px,3.4vw,15px)}
.explore-dest{display:grid;grid-template-columns:minmax(0,1fr);align-items:center;gap:2px;width:100%;text-align:left;border:0;border-top:2px dashed var(--ink);background:none;padding:8px 10px 9px;color:inherit;font:inherit}
.explore-bh+.explore-dest{border-top:0}
.explore-dest:active,.explore-rh:active{background:var(--yellow-t)}
.explore-dn{display:flex;align-items:baseline;gap:8px;min-width:0}
.explore-dn b{font-size:20px;letter-spacing:1px;font-variant-numeric:tabular-nums}
.explore-dn span{font-size:13px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.explore-c{font-size:15px;line-height:1.5;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:center}
.explore-c i{font-style:normal;padding:0 2px}
.explore-c.on i{background:linear-gradient(transparent 58%,var(--yellow) 58%)}
.explore-c.na i{color:#A39C98}
.explore-c.odd i{color:#766E6A;text-decoration:underline dotted 1.5px;text-underline-offset:3px}
.explore-c.odd sup{font-size:11px;line-height:0;color:#766E6A;margin-left:1px}
.explore-c.odd.on i{background:none}
.explore-oddnote{color:var(--ink2)}
@media (max-width:359px){.explore-c{font-size:14px}}
@media (min-width:560px){.explore-dest,.explore-bh{grid-template-columns:200px minmax(0,1fr)}.explore-bh0{display:block}.explore-sortlbl{display:none}}
.explore-sel{cursor:pointer}
.explore-sel select{position:absolute;inset:0;width:100%;height:100%;opacity:0;font-size:16px;cursor:pointer}
.explore-sv{display:block;font-size:17px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:20px}
html[lang=en] .explore-sv{font-size:16px}
.explore-sel::after{content:'';position:absolute;right:14px;top:50%;width:7px;height:7px;border-right:2.5px solid var(--ink);border-bottom:2.5px solid var(--ink);transform:translateY(-15%) rotate(45deg);pointer-events:none}
.explore-pinfo{font-size:12px;color:var(--ink2);margin:-6px 4px 0}
.explore-pinfo:empty{display:none}
.explore-cabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.explore-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
@media (max-width:359px){.explore-two{grid-template-columns:minmax(0,1fr)}}
.explore-dates{display:grid;grid-template-columns:minmax(0,1fr) 26px minmax(0,1fr);gap:6px;align-items:center}
.explore-dates .to{text-align:center;font-size:15px}
.explore-bgo{justify-self:start;min-height:44px;padding:3px 28px;font-size:17px}
.explore-morebox .btn,.explore-sr{min-height:40px}
.explore-ff{display:flex;align-items:flex-start;gap:8px;margin:2px 0}
.explore-fl{flex:0 0 auto;min-width:2.6em;padding-top:14px;font-size:13px;line-height:20px;color:var(--ink2)}
.explore-chips{flex:1;min-width:0;display:flex;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:4px 2px}
.explore-chips::-webkit-scrollbar{display:none}
.explore-chips .chip{flex:0 0 auto;min-height:40px;white-space:nowrap;letter-spacing:.5px}
.explore-chips .chip small{font-size:11px;color:var(--ink2);letter-spacing:0}
@media (hover:hover) and (pointer:fine){.explore-chips{flex-wrap:wrap;overflow-x:visible}.explore-dest:hover,.explore-rh:hover{background:var(--yellow-t)}}
.explore-fclear{font-size:13px;padding:1px 12px;margin:4px 0;min-height:40px}
.explore-routes{margin-top:8px}
.explore-rt+.explore-rt{border-top:2px dashed var(--ink)}
.explore-rt.open{background:var(--water-t)}
.explore-rh{display:block;width:100%;text-align:left;border:0;background:none;padding:9px 12px 8px;color:inherit;font:inherit}
.explore-r1{display:flex;align-items:center;gap:6px;min-width:0}
.explore-rc{display:inline-flex;align-items:center;font-size:19px;letter-spacing:.5px;white-space:nowrap}
.explore-rc .ar{display:inline-block;width:26px;height:17px;margin:0 5px}
.explore-rc .ar svg{width:100%;height:100%}
.explore-r1 .mi{font-size:21px}
.explore-r2{display:block;font-size:12px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.explore-r3{display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;font-size:13px;margin-top:3px}
.explore-r3 .chev{width:18px;height:18px;margin-left:auto;transition:transform .25s var(--pop)}
.explore-rh[aria-expanded=true] .chev{transform:rotate(180deg)}
.explore-rd{padding:0 12px 12px;animation:pop .35s var(--pop)}
.explore-days{list-style:none;margin:0 0 10px;padding:0;border-top:2px solid var(--ink)}
.explore-days li{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 10px;padding:6px 0;border-bottom:2px dashed var(--ink);font-variant-numeric:tabular-nums}
.explore-days .dd{min-width:5.6em;font-size:15px}
.explore-days .dm{font-size:15px}
.explore-days .dt{font-size:12px;color:var(--ink2)}
.explore-days small{flex-basis:100%;display:flex;flex-wrap:wrap;gap:0 10px;font-size:12px;color:var(--ink2)}
.explore-air{white-space:nowrap}
.explore-rd .note0{margin:8px 0 0}
.explore-showmore{min-height:44px}
`,
  en: {
    '探索': 'Explore',
    '探索方式': 'Explore by',
    '直飛目的地': 'Nonstop destinations',
    '計畫瀏覽': 'Browse a program',
    '方向': 'Direction',
    '從這裡出發': 'Flying from',
    '飛到這裡': 'Flying to',
    '機場': 'Airport',
    '例：TPE': 'e.g. TPE',
    '查直飛': 'Find nonstops',
    '、': ', ',
    '請輸入一個機場代號，例如 TPE。': 'Enter one airport code, e.g. TPE.',
    '「{0}」有 {1} 個機場，請選一個：': '"{0}" has {1} airports. Pick one:',
    '選一個機場，看它直飛哪些地方，還有各艙等最低要幾哩。': 'Pick an airport to see where it flies nonstop, and the fewest miles seen in each cabin.',
    'seats.aero 沒有回傳目的地清單，等一下再試。': 'seats.aero sent no list of destinations. Try again in a moment.',
    'seats.aero 沒有 {0} 的直飛資料，換個機場試試。': 'seats.aero has no nonstop data for {0}. Try another airport.',
    '從 {0} 直飛：{1} 個目的地': 'Nonstop from {0}: {1} destinations',
    '從 {0} 直飛：1 個目的地': 'Nonstop from {0}: 1 destination',
    '直飛 {0}：{1} 個出發機場': 'Nonstop to {0}: from {1} airports',
    '直飛 {0}：1 個出發機場': 'Nonstop to {0}: from 1 airport',
    '數字是 seats.aero 快取裡看過最低的直飛里程：任何計畫、任何日期都算，現在不一定還有位子。不同計畫的 1 哩價值不同，不能直接比。':
      "Each number is the lowest nonstop award seen in seats.aero's cache, in any program on any date, and it may be gone now. A mile is worth a different amount in each program, so don't compare them directly.",
    '標 ? 的灰色數字不到 1,000 哩，看起來不對，可能是資料錯誤。': 'Grey numbers marked ? are under 1,000 miles. They look wrong, probably a data error.',
    '看起來不對': 'looks wrong',
    '按「查直飛」，看 {0} 直飛哪些地方。': 'Tap Find nonstops to see where {0} flies nonstop.',
    '按「查直飛」，看哪些機場直飛 {0}。': 'Tap Find nonstops to see which airports fly nonstop to {0}.',
    '選一個機場，看哪些機場直飛那裡，還有各艙等最低要幾哩。': 'Pick an airport to see which airports fly nonstop to it, and the fewest miles seen in each cabin.',
    '最遠只能查到 {0}，兩個日期都已改成這一天。': 'Dates go out only to {0}, so both dates are now that day.',
    '最遠只能查到 {0}，最晚日期已改成這一天。': 'Dates go out only to {0}, so the latest date is now that day.',
    '這些直飛航線在 seats.aero 都沒有{0}的紀錄。': 'seats.aero has no {0} record on any of these nonstop routes.',
    '點一個目的地，會在搜尋頁查明天起 60 天的{0}（約用 1 到 2 次額度）。': 'Tap a destination to search the 60 days from tomorrow in {0} (about 1 to 2 calls).',
    '點一個機場，會在搜尋頁查明天起 60 天的{0}（約用 1 到 2 次額度）。': 'Tap an airport to search the 60 days from tomorrow in {0} (about 1 to 2 calls).',
    '依艙等排序': 'Sort by cabin',
    '沒有': 'none',
    '里程計畫': 'Program',
    '艙等': 'Cabin',
    '出發地區': 'From region',
    '目的地區': 'To region',
    '北美': 'North America',
    '南美': 'South America',
    '非洲': 'Africa',
    '亞洲': 'Asia',
    '歐洲': 'Europe',
    '大洋洲': 'Oceania',
    'seats.aero 的「亞洲」也包含中東，例如杜拜、阿布達比、特拉維夫。': "seats.aero's Asia also includes the Middle East, such as Dubai, Abu Dhabi and Tel Aviv.",
    '最早日期': 'Earliest',
    '最晚日期': 'Latest',
    '到': 'to',
    '{0} ({1})': '{1} {0}',
    '日期最多 60 天。每次搜尋用 1 次額度，最多 1,000 筆。': 'Up to 60 days. Each search uses 1 call and brings up to 1,000 results.',
    '搜尋': 'Search',
    '這些日期已經過了。': 'These dates have already passed.',
    '最晚日期已跟著改成 {0}。': 'The latest date moved with it, to {0}.',
    '最晚日期不能早於最早日期，已改成 {0}。': "The latest date can't be before the earliest, so it is now {0}.",
    '日期最多 {0} 天，最晚日期已改成 {1}。': 'Up to {0} days: the latest date is now {1}.',
    '選好計畫、艙等、地區和日期，按「搜尋」。': 'Pick a program, cabin, regions and dates, then tap Search.',
    '{0} 到 {1}': '{0} to {1}',
    '1 條航線有位': '1 route with seats',
    '{0} 條航線有位': '{0} routes with seats',
    '，篩選後 {0} 條': ', {0} after filtering',
    '資料更新：最新 {0}，最舊 {1}': 'Data updated: newest {0}, oldest {1}',
    '更新': 'updated',
    '還有更多結果': 'There are more results',
    'seats.aero 依日期排序，目前載入到 {0}。': 'seats.aero sends them in date order. Loaded through {0} so far.',
    '讀取中…': 'Loading…',
    '載入更多（再用 1 次額度）': 'Load more (1 more call)',
    '出發': 'From',
    '抵達': 'To',
    '清除機場篩選': 'Clear airport filters',
    '沒有符合這些機場的航線。': 'No routes match these airports.',
    '再顯示 {0} 條（還有 {1} 條）': 'Show {0} more ({1} left)',
    '里程是這個計畫在 seats.aero 快取裡的價格，訂位前請到航空公司網站確認。': "Miles are this program's prices in seats.aero's cache. Check with the airline before you book.",
    '這段日期沒有找到位子。可以換個艙等、地區或日期再試。': 'No seats found for these dates. Try another cabin, region or dates.',
    '哩': 'miles',
    '1 天有位': 'Seats on 1 day',
    '{0} 天有位': 'Seats on {0} days',
    '最早 {0}': 'earliest {0}',
    '{0} 哩': '{0} miles',
    '剩 1 位': '1 seat left',
    '剩 {0} 位': '{0} seats left',
    '直飛': 'Nonstop',
    '搜尋這條': 'Search this route',
    '會在搜尋頁查 {0} 到 {1} 這條航線的所有計畫。': 'Searches every program on this route, {0} to {1}.',
    '查不到': 'Search failed',
    '再試一次': 'Try again',
  },
  show(match, el) {
    if (!el.dataset.wired) {
      el.dataset.wired = '1';
      el.addEventListener('click', onClick);
      el.addEventListener('submit', onSubmit);
      el.addEventListener('change', onChange);
      el.addEventListener('input', onInput);
    }
    if (!B) B = browseLoad();
    if (!D && P.ap) D = cachedDest(P.dir, P.ap);   // no call just for opening the page
    draw();
    // back from a search started here: route() scrolls feature pages to the top just after this, so go back after it
    if (backTo != null) { const y = backTo; backTo = null; requestAnimationFrame(() => scrollTo(0, y)); }
  },
});
})();
