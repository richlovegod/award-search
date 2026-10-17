/* 開票日 (award release dates) and 開票提醒 (an email on the day a travel date opens), 2026-10-15.
   #/release: pick a travel date and see when each program opens it, sorted by that day, with 提醒我 on the ones
   not open yet; below, every program's window with a note on partner seats and its source. Also: hatched days on
   the results calendar where some programs have not opened yet (with a line under the summary), and a 開票提醒
   card on 我的提醒. Worker side: worker/src/features/release.js (GET/POST /me/reminders, DELETE /me/reminders/:id).
   Costs no seats.aero call (only 用這天搜尋 runs a search, like the 搜尋 button). */
(() => {
'use strict';

// Days before departure each seats.aero program opens award bookings, checked 2026-10-14 (research in
// .claude/tmp/award-search/release-windows.json); the Worker holds the same numbers. lo/hi: the range when sources
// disagree (sorting and reminders use hi, the earliest day it may open); was: the figure it replaced; src: keys of
// SOURCES, pages that state the number (checked 2026-10-15); note: what to know about partner seats.
// Spirit is not here: it stopped flying in May 2026.
const AS_OF = '2026-10-14';
const SOURCES = {
  rt: ['reisetopia', 'https://reisetopia.de/guides/praemienfluege-buchung-zeitpunkt/', '2026/10/5'],
  up: ['Upgraded Points', 'https://upgradedpoints.com/travel/airlines/when-do-airlines-release-award-seats/', '2026/4/30'],
  af: ['AwardFares', 'https://awardfares.com/blog/ultimate-guide-to-award-release-dates/', '2026/7/7'],
  afsv: ['AwardFares', 'https://awardfares.com/programs/saudia-alfursan', ''],
  aw: ['AwardWallet', 'https://awardwallet.com/airlines/far-advance-can-book-airline-award-tickets/', '2026/4/8'],
  ph: ['Point Hacks', 'https://www.pointhacks.com.au/when-do-award-calendars-open/', '2026/10/7'],
  hfp: ['Head for Points', 'https://www.headforpoints.com/2026/09/14/how-far-in-advance-can-you-book-flights-with-avios-4/', '2026/9/14'],
  ba: ['British Airways', 'https://www.britishairways.com/content/information/help/faq/booking/how-far-in-advance-book-flight', '2024/4/30'],
};
const SAME_AS_DELTA = '夥伴航班要等到 331 天內，而且對方也放出位子，才看得到。';
const W = {
  united: { days: 337, st: 'confirmed', src: ['rt'], note: '合作夥伴的位子也要等到 337 天內才看得到，就算對方更早開放。' },
  aeroplan: { days: 355, st: 'confirmed', src: ['rt'], note: '合作夥伴的位子常常比較晚才出現。' },
  turkish: { days: 355, st: 'approx', lo: 330, hi: 355, src: ['aw', 'af'], note: '用 Miles&Smiles 訂星空聯盟夥伴，可能要到約 331 天才看得到。' },
  singapore: { days: 355, st: 'confirmed', src: ['af'], note: '合作夥伴計畫拿到的新航位子少很多。西雅圖、洛杉磯、舊金山出發的位子在新加坡時間下午 3 點放出。' },
  lufthansa: { days: 361, st: 'confirmed', src: ['rt'], note: '其他網站多寫 360 天。合作夥伴計畫要很晚才拿得到漢莎的商務艙和頭等艙。' },
  connectmiles: { days: 330, st: 'approx', lo: 330, hi: 337, src: ['af', 'aw'], note: 'Copa 官方沒有寫。星空聯盟夥伴的位子照各家自己的開放時間。' },
  ethiopian: { days: 331, st: 'confirmed', src: ['aw'], note: '各來源差幾天（328 到 331 天）。夥伴航班照各家自己的開放時間。' },
  lifemiles: { days: 360, st: 'corrected', was: 355, src: ['rt'], note: '夥伴航班有時比哥倫比亞航空自己的航班更早開放。' },
  american: { days: 331, st: 'confirmed', src: ['up'], note: '夥伴航班也要等到 331 天內才訂得到，所以國泰、日航、卡達在這裡比較晚出現。' },
  alaska: { days: 330, st: 'confirmed', src: ['up'], note: '夥伴航班看兩邊誰比較短：阿拉斯加的 330 天，或對方自己的開放時間。' },
  qantas: { days: 353, st: 'confirmed', src: ['ph'], note: '夥伴航班最多也是 353 天；捷星約 300 天，阿聯酋約 330 天。' },
  qatar: { days: 361, st: 'confirmed', src: ['hfp'], note: '英航要晚 6 天（355 天）才訂得到卡達的位子，美國航空和阿拉斯加約 331 天。大部分商務艙只給 Avios 計畫。' },
  finnair: { days: 360, st: 'confirmed', src: ['ph'], note: '夥伴航班要等對方放出位子，例如美國航空 331 天。' },
  british: { days: 354, st: 'corrected', was: 355, src: ['ba'], note: '官網寫 355 天，但實際上最遠只能訂到第 354 天。夥伴的位子照對方放出的時間。' },
  iberia: { days: 360, st: 'confirmed', src: ['up'], note: '伊比利亞自己的位子在 iberia.com 比英航官網早 5 天出現。' },
  delta: { days: 331, st: 'confirmed', src: ['up'], note: SAME_AS_DELTA },
  flyingblue: { days: 359, st: 'confirmed', src: ['ph'], note: '359 天是法航荷航自己的航班。夥伴比較晚，例如達美 330 天、大韓 351 天。' },
  virginatlantic: { days: 331, st: 'confirmed', src: ['ph'], note: SAME_AS_DELTA },
  aeromexico: { days: 330, st: 'confirmed', src: ['up'], note: '墨西哥國際航空的航班在 331 天放出，所以達美的會員可能比它自己的會員早一天看到。' },
  eurobonus: { days: 330, st: 'confirmed', src: ['af'], note: '北歐航空自己的位子約 330 天才放出；搜尋可以查到約 361 天，所以法航荷航（359 天）等夥伴會先出現。' },
  saudia: { days: 330, st: 'approx', src: ['afsv'], note: '其他計畫（例如 EuroBonus、Flying Blue）可能比 AlFursan 更早看到沙烏地航空的航班。' },
  emirates: { days: 328, st: 'confirmed', src: ['af'], note: '頭等艙多半只留給 Skywards 會員；澳航約 330 天才拿到阿聯酋的位子。' },
  etihad: { days: 330, st: 'confirmed', src: ['ph'], note: '提前 30 天以上，大部分商務艙和頭等艙只給 Etihad Guest 會員。' },
  velocity: { days: 331, st: 'confirmed', src: ['af'], note: '維珍澳洲、新航、卡達一開放就有位子；聯合航空常要等到出發前 1 到 2 個月。' },
  jetblue: { days: 331, st: 'confirmed', src: ['aw'], note: '331 天是捷藍自己的航班；夥伴航班沒有可靠的資料。' },
  azul: { days: 330, st: 'approx', src: ['af'], note: 'Azul 可能分批放出航班，比較晚的日期不一定已經有了。' },
  smiles: { days: 330, st: 'confirmed', src: ['af'], note: '夥伴航班不一定，最多 330 天。' },
  frontier: { days: null, st: 'unknown', src: ['af'], note: '沒有夥伴獎勵機票。航班表分批放出，大約提前 8 個月，不是固定天數。' },
};
const KNOWN = Object.keys(W).filter(k => W[k].days != null);
const hiOf = k => W[k].hi || W[k].days;
const loOf = k => W[k].lo || W[k].days;
const LONGEST = Math.max(...KNOWN.map(hiOf));    // 361: later days have no program open
const SHORTEST = Math.min(...KNOWN.map(loOf));   // 328: later days have only some programs open
const AHEAD_MAX = 399;                           // the Worker takes 400 days after its UTC date; here one less, for Asia's mornings
const DATE_KEY = 'award-release-date';           // the date picked on this page, for the session

/* ---------- dates (local calendar days, like the search form) ---------- */
const addDays = (iso, k) => { const d = parseDate(iso); d.setDate(d.getDate() + k); return isoDate(d); };
const today = () => isoDate(new Date());
// 10/16, or 2027/1/5 in another year; with the weekday 10/16（五） / Fri 10/16
function dayText(iso, wd) {
  const d = parseDate(iso), s = (d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '/' : '') + (d.getMonth() + 1) + '/' + d.getDate();
  return wd ? t('{0}（{1}）', s, WD[d.getDay()]) : s;
}
const validDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && isoDate(parseDate(v)) === v && v > today() && daysBetween(today(), v) <= AHEAD_MAX;
// one program for one travel date: open (the earliest day it may open), sure (the day every source agrees),
// st: 'open', 'maybe' (between the two) or 'soon'; wait = days from today to open
function relState(k, travel, now) {
  const w = W[k];
  if (!w || w.days == null) return { k, unk: true };
  const hi = hiOf(k), lo = loOf(k), open = addDays(travel, -hi), sure = addDays(travel, -lo);
  return { k, hi, lo, open, sure, st: sure <= now ? 'open' : open <= now ? 'maybe' : 'soon', wait: daysBetween(now, open), approx: w.st === 'approx' };
}
// for other features: when a program opens a travel date ({ open, sure, st, wait, hi, lo } or { unk: true } when
// its window is not fixed; null for a program not in the table); .windows is the table, .asOf its date
window.releaseInfo = (src, travel) => (Object.prototype.hasOwnProperty.call(W, src) && /^\d{4}-\d{2}-\d{2}$/.test(travel || '') ? relState(src, travel, today()) : null);
window.releaseInfo.windows = W;
window.releaseInfo.asOf = AS_OF;

let DATE = null;
function pickDate() {
  if (!validDate(DATE)) { const v = sessionStorage.getItem(DATE_KEY); DATE = validDate(v) ? v : addDays(today(), 330); }
  return DATE;
}

/* ---------- the account's reminders (GET /me/reminders, kept for the session) ---------- */
// REM: the last answer ({ reminders, max, verified, allowed }) for the account REM_WHO; another account signed in
// means no cache. OPS: what this page added or deleted while a GET was on its way, applied to that GET's answer,
// so a slow GET cannot undo a tap.
let REM = null, REM_WHO = '', REM_AT = 0, REM_P = null, REM_ERR = '', OPS = [];
const who = () => (ME && ME.email) || '';
function sync() { if (REM_WHO !== who()) { REM = null; REM_AT = 0; REM_ERR = ''; OPS = []; REM_WHO = who(); } }
function loadRem(force) {
  sync();
  if (REM && !force && Date.now() - REM_AT < 10 * 60000) return Promise.resolve(REM);
  if (REM_P && REM_P.who === who()) return REM_P;
  const me = who();
  OPS = [];
  const p = call('GET', '/me/reminders').then(r => {
    if (me !== who()) return who() ? loadRem(true) : null;   // signed out, or into another account, meanwhile
    for (const [op, x] of OPS) r.reminders = r.reminders.filter(y => y.id !== (op === 'add' ? x.id : x)).concat(op === 'add' ? [x] : []);
    OPS = [];
    REM = r; REM_AT = Date.now(); REM_ERR = '';
    return r;
  }, err => {
    if (me === who()) REM_ERR = err.message;
    throw err;
  }).finally(() => { if (REM_P === p) REM_P = null; });
  p.who = me;
  return (REM_P = p);
}
// a change made here: kept in REM, and in OPS while a GET is on its way
function remChange(op, x) {
  if (op === 'add') REM.reminders = REM.reminders.filter(y => y.id !== x.id).concat(x);
  else REM.reminders = REM.reminders.filter(y => y.id !== x);
  if (REM_P) OPS.push([op, x]);
}
const remOf = (k, travel) => (REM ? REM.reminders.find(r => r.source === k && r.travel_date === travel) : null) || null;
const remOff = () => !!(REM && REM.allowed === false);   // the admin switched this account's alerts off
const POST_ERR = { already_open: '這個計畫已經開放這天的位子了。', too_many: '開票提醒最多 {0} 個，先刪掉一些再設定。', param: '日期或計畫不對。', alerts_off: '管理員關閉了這個帳號的提醒功能。' };
// focus without scrolling, after a redraw removed the focused button (keyboard and VoiceOver users keep their place)
const focusOn = el => { if (el) { try { el.focus({ preventScroll: true }); } catch { el.focus(); } } };

// the airports in the search form, so the email can link to that search
function formRoute() {
  try {
    const a = resolve($('#from').value || ''), b = resolve($('#to').value || '');
    return a.err || b.err || !a.codes.length || !b.codes.length ? null : { o: a.codes.join(','), d: b.codes.join(',') };
  } catch { return null; }
}
const routeText = r => r.o.split(',').join('/') + ' → ' + r.d.split(',').join('/');
const nameOf = k => prog(k).name;
// the airline under the program's name; in English it is left out when it only repeats it (United, United Airlines)
const subOf = k => { const p = prog(k); return p.zh && !p.zh.toLowerCase().startsWith(p.name.toLowerCase()) ? p.zh : ''; };
const byOpen = (a, b) => (a.open < b.open ? -1 : a.open > b.open ? 1 : nameOf(a.k).localeCompare(nameOf(b.k)));

/* ---------- the page ---------- */
function show(match, body) {
  if (!body.dataset.bound) {
    body.dataset.bound = '1';
    body.addEventListener('change', e => { if (e.target.id === 'release-date') setDate(e.target.value); });
    body.addEventListener('click', e => {
      if (e.target.id === 'release-date') { try { e.target.showPicker(); } catch {} return; }
      const add = e.target.closest('[data-rel-add]');
      if (add) { addReminder(add.dataset.relAdd, add); return; }
      if (e.target.closest('[data-rel-search]')) searchDate();
    });
  }
  pickDate();
  sync();
  // the date box looks like the search form's: the date and weekday big, the year by the label, and the real
  // date input on top, invisible, so a tap opens the iPhone picker
  body.innerHTML =
    '<div class="acard y release-pick"><h3>' + t('我想搭的日期') + '</h3>' +
      '<div class="field df"><label for="release-date">' + t('搭機日') + '<small id="release-y"></small></label><span class="dv" id="release-dv"></span>' +
        '<input type="date" id="release-date" value="' + DATE + '" min="' + addDays(today(), 1) + '" max="' + addDays(today(), AHEAD_MAX) + '"></div>' +
      '<p class="note0">' + t('每個計畫在搭機日前固定的天數開放訂位，下面從這天往回算。') + '</p>' +
      '<p class="msg" id="release-msg" role="status"></p><div id="release-top"></div></div>' +
    '<div class="acard release-tlc" id="release-list"></div>' + rulesHtml();
  drawList();
  loadRem().then(drawList, drawList);
}
function setDate(v) {
  if (!validDate(v)) {
    setMsg('release-msg', t('請選明天到 {0} 之間的日期。', dayText(addDays(today(), AHEAD_MAX))));
    $('#release-date').value = DATE;
    return;
  }
  DATE = v;
  try { sessionStorage.setItem(DATE_KEY, v); } catch {}
  setMsg('release-msg', '');
  drawList();
}
function drawPick() {
  const d = parseDate(DATE), dv = $('#release-dv'), y = $('#release-y'), input = $('#release-date');
  if (!dv) return;
  dv.textContent = t('{0}（{1}）', (d.getMonth() + 1) + '/' + d.getDate(), WD[d.getDay()]);
  y.textContent = d.getFullYear();
  if (input.value !== DATE) input.value = DATE;
}

// the summary under the date, then the timeline: what is open already, today, then each day something opens
function drawList() {
  const box = $('#release-list'), top = $('#release-top');
  if (!box || !top) return;
  sync();
  drawPick();
  const now = today(), travel = DATE;
  const items = Object.keys(W).map(k => relState(k, travel, now));
  const known = items.filter(x => !x.unk).sort(byOpen), unk = items.filter(x => x.unk);
  const done = known.filter(x => x.st !== 'soon'), soon = known.filter(x => x.st === 'soon');
  const maybe = done.filter(x => x.st === 'maybe').length, route = formRoute();
  top.innerHTML = '<p class="release-stats"><span>' + t('已開放') + '<b>' + (done.length - maybe) + '</b></span>' +
      (maybe ? '<span>' + t('可能已開放') + '<b>' + maybe + '</b></span>' : '') + '<span>' + t('還沒開') + '<b>' + soon.length + '</b></span></p>' +
    (soon.length ? '' : '<p class="note0 release-all">' + t('這天所有計畫都開放了，可以直接搜尋。') + '</p>') +
    // up here, where it explains why the list below has no 提醒我
    (remOff() ? '<p class="note0 release-off">' + t('管理員關閉了這個帳號的提醒功能。') + '</p>' : '') +
    (route ? '<div class="release-acts"><button type="button" class="btn pri" data-rel-search="1">' + t('用這天搜尋 {0}', esc(routeText(route))) + '</button></div>' : '');
  const groups = list => { const m = new Map(); for (const x of list) { if (!m.has(x.open)) m.set(x.open, []); m.get(x.open).push(x); } return [...m]; };
  // open per some sources only, or per a single source
  const tagOf = x => (x.st === 'maybe' ? '<span class="tag release-may">' + t('可能') + '</span>' : x.approx && x.lo === x.hi ? '<span class="tag release-may">' + t('約') + '</span>' : '');
  let h = '';
  if (done.length) {
    h += '<div class="release-done"><p class="lbl">' + t('已開放，現在就能搜尋') + '</p>' + groups(done).map(([open, xs]) =>
      '<div class="release-oline"><span class="release-ow"><span class="release-od">' + t('{0} 起', dayText(open)) + '</span><span class="release-odays">' + t('{0} 天', xs[0].hi) + '</span></span>' +
      '<span class="release-onames">' + xs.map(x => '<span class="release-on" data-src="' + x.k + '">' + logo(prog(x.k).code) + esc(nameOf(x.k)) + tagOf(x) + '</span>').join('') + '</span></div>').join('') + '</div>';
  }
  if (soon.length) {
    h += '<div class="release-now"><span>' + t('今天 {0}', dayText(now, true)) + '</span></div><ol class="release-tl">' + groups(soon).map(([open, xs]) => {
      const d = parseDate(open), wait = xs[0].wait;
      return '<li class="release-grp" data-open="' + open + '"><div class="release-gh">' +
        '<span class="release-cal" aria-hidden="true"><b>' + t('{0} 月', d.getMonth() + 1, d.toLocaleDateString(LOC(), { month: 'short' })) + '</b><span>' + d.getDate() + '</span></span>' +
        '<span class="release-gt"><b>' + t('{0}開放', dayText(open, true)) + '</b><span class="release-gs"><small>' + t('提前 {0} 天', xs[0].hi) + '</small>' +
        '<span class="release-cd">' + (wait === 1 ? t('明天開放') : t('倒數 {0} 天', wait)) + '</span></span></span></div>' +
        '<ul class="release-rows">' + xs.map(rowHtml).join('') + '</ul></li>';
    }).join('') + '</ol>';
  }
  for (const x of unk) {
    h += '<div class="release-grp unk"><div class="release-gh"><span class="release-cal" aria-hidden="true"><b>&nbsp;</b><span>?</span></span>' +
      '<span class="release-gt"><b>' + t('不固定') + '</b><small>' + t('大約提前 8 個月，航班表分批放出') + '</small></span></div>' +
      '<ul class="release-rows"><li class="release-row" data-src="' + x.k + '">' + logo(prog(x.k).code) + progName(x.k) + '</li></ul></div>';
  }
  const hints = [];
  // verified and allowed are null until GET /me/reminders has answered: say nothing about them until then; with
  // alerts off, the line at the top says it all
  if (!remOff()) {
    if (soon.length) hints.push(route ? t('提醒信會附上 {0} 的搜尋連結。', esc(routeText(route))) : t('先在搜尋頁填好出發和抵達，提醒信就會附上搜尋連結。'));
    if (REM && REM.verified === false) hints.push(t('Email 還沒驗證，提醒不會寄出。') + ' <a href="#/alerts">' + t('去驗證') + '</a>');
    else if (REM && REM.reminders.length) hints.push('<a href="#/alerts">' + t('管理開票提醒（{0} 個）', REM.reminders.length) + '</a>');
  }
  if (REM_ERR && !REM) hints.push(esc(t('讀不到你的開票提醒：{0}', REM_ERR)));
  box.innerHTML = h + hints.map(x => '<p class="release-hint">' + x + '</p>').join('');
}
const progName = k => '<span class="release-pn"><span>' + esc(nameOf(k)) + '</span>' + (subOf(k) ? '<small>' + esc(subOf(k)) + '</small>' : '') + extraOf(k) + '</span>';
const extraOf = k => { const w = W[k]; return w.lo ? '<em>' + t('說法不一：{0} 到 {1} 天', w.lo, w.hi) + '</em>' : w.st === 'approx' ? '<em>' + t('約 {0} 天，只有一個來源', w.days) + '</em>' : ''; };
// a program not open yet: 提醒我, or ✓ 已設提醒 (focusable from script, so focus can land on it after 提醒我);
// nothing when the admin has switched this account's alerts off
function rowHtml(x) {
  const r = remOf(x.k, DATE);
  return '<li class="release-row" data-src="' + x.k + '">' + logo(prog(x.k).code) + progName(x.k) +
    (remOff() ? '' : r ? '<span class="tag release-set" tabindex="-1">' + t('✓ 已設提醒') + '</span>'
      : '<button type="button" class="btn release-btn" data-rel-add="' + x.k + '" aria-label="' + esc(t('{0} 開放時提醒我', nameOf(x.k))) + '">' + t('提醒我') + '</button>') + '</li>';
}

async function addReminder(k, btn) {
  const travel = DATE, x = relState(k, travel, today());
  if (x.unk || x.st !== 'soon') return;
  btn.disabled = true;
  const body = { source: k, travel_date: travel, lang: LANG }, rt = formRoute(), me = who();
  if (rt) Object.assign(body, rt);
  try {
    const r = await call('POST', '/me/reminders', body);
    sync();
    if (me !== who()) return;   // signed into another account meanwhile
    if (!REM) REM = { reminders: [], max: 30, verified: null, allowed: null };   // GET has not answered (or failed)
    remChange('add', r.reminder);
    drawList();
    focusOn($('.release-row[data-src="' + k + '"] .release-set'));
    toast(REM.verified === false ? t('已設提醒。Email 驗證之後才會寄信（在「我的提醒」）')
      : t('已設提醒：{0} 在 {1} 開放', nameOf(k), dayText(r.reminder.open_date)));
  } catch (err) {
    btn.disabled = false;
    if (err.kind === 'alerts_off' && me === who()) {
      if (!REM) REM = { reminders: [], max: 30, verified: null, allowed: null };
      REM.allowed = false;
      drawList();
    }
    toast(POST_ERR[err.kind] ? t(POST_ERR[err.kind], (REM && REM.max) || 30) : err.message);
  }
}
// 用這天搜尋: the form's airports, the travel date and two days after, searched like the 搜尋 button
function searchDate() {
  const rt = formRoute();
  if (!rt) return;
  location.hash = '#/';
  route();   // show the search page now: a cached search scrolls to its results before hashchange runs
  fillForm({ o: rt.o, d: rt.d, s: DATE, e: addDays(DATE, 2) });
  const p = readForm();
  if (p) runSearch(p, false, true);
}

// every program: its window, how sure it is, a note on partner seats, and where the number comes from
function rulesHtml() {
  const rank = k => (W[k].days == null ? -1 : hiOf(k));
  const keys = Object.keys(W).sort((a, b) => rank(b) - rank(a) || nameOf(a).localeCompare(nameOf(b)));
  return '<section class="acard release-rules"><h3>' + t('各計畫提前幾天開放') + '</h3>' +
    '<p class="note0">' + t('合作夥伴（其他航空公司）的位子常常比較晚才放出。資料在 {0} 查證，實際開放的日子可能差一兩天。', AS_OF.replace(/-0?/g, '/')) + '</p>' +
    keys.map(ruleHtml).join('') + '</section>';
}
function ruleHtml(k) {
  const w = W[k], p = prog(k);
  const days = w.days == null ? t('約 8 個月') : w.lo ? t('{0} 到 {1} 天', w.lo, w.hi) : w.st === 'approx' ? t('約 {0} 天', w.days) : t('{0} 天', w.days);
  const tag = w.st === 'confirmed' ? ['release-ok', t('已查證')] : w.st === 'corrected' ? ['release-fix', t('已更正，原本寫 {0} 天', w.was)]
    : w.st === 'approx' ? ['release-mix', w.lo ? t('說法不一') : t('只有一個來源')] : ['release-mix', t('不固定')];
  const links = w.src.map(s => SOURCES[s]).map(([n, u, d]) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(n + (d ? ' ' + d : '')) + '</a>').join('<span>' + t('、') + '</span>');
  return '<div class="release-rule" data-src="' + k + '"><div class="release-rh">' + logo(p.code) + '<b>' + esc(p.name) + '</b>' + (subOf(k) ? '<small>' + esc(subOf(k)) + '</small>' : '') +
    '<span class="release-rd">' + days + '</span></div>' +
    '<p class="release-rt"><span class="tag ' + tag[0] + '">' + tag[1] + '</span>' + esc(t(w.note)) + '</p>' +
    '<p class="release-srcs"><span>' + (w.src.length > 1 ? t('各來源：') : t('來源：')) + '</span>' + links + '</p></div>';
}

/* ---------- the results calendar: days not every program has opened yet ---------- */
function onRender() {
  const cal = $('#cal');
  if (!cal || !S.params) return;
  const now = today();
  for (const b of cal.querySelectorAll('.day[data-d]')) {
    const n = daysBetween(now, b.dataset.d);
    if (n <= SHORTEST) continue;
    const tip = n > LONGEST ? t('還沒有計畫開票') : t('已開票：{0}/{1} 個計畫', KNOWN.filter(k => hiOf(k) >= n).length, KNOWN.length);
    b.classList.add(n > LONGEST ? 'rel-closed' : 'rel-partial');
    b.title = tip;
    b.setAttribute('aria-label', t('{0}；{1}', b.getAttribute('aria-label') || '', tip));
  }
  calNote();
}
// one line under the summary when the search reaches days not every program has opened
function calNote() {
  let el = $('#release-note');
  if (!el) {
    const f = $('#fresh');
    if (!f) return;
    el = document.createElement('p');
    el.id = 'release-note'; el.className = 'release-note'; el.hidden = true;
    f.insertAdjacentElement('afterend', el);
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-rel-go]');
      if (!a) return;
      e.preventDefault();
      DATE = a.dataset.relGo;
      try { sessionStorage.setItem(DATE_KEY, DATE); } catch {}
      location.hash = '#/release';
    });
    // a new search empties the calendar first: the line goes with it until the new results are drawn
    const cal = $('#cal');
    if (cal && window.MutationObserver) new MutationObserver(() => { if (!cal.children.length) el.hidden = true; }).observe(cal, { childList: true });
  }
  const p = S.params, now = today();
  const part = addDays(now, SHORTEST + 1), none = addDays(now, LONGEST + 1);
  if (!p || !p.e || p.e < part) { el.hidden = true; el.innerHTML = ''; return; }
  const first = p.s > part ? p.s : part;
  const msg = p.s >= none ? t('這段日期還沒有計畫開票，最早的在 {0} 開放。', dayText(addDays(p.s, -LONGEST)))
    : p.e >= none ? t('斜線的日子還沒全部開票：{0} 起只有部分計畫開放，{1} 起都還沒開。', dayText(first), dayText(none))
    : t('斜線的日子還沒全部開票：{0} 起只有部分計畫開放。', dayText(first));
  const go = validDate(first) ? first : addDays(now, AHEAD_MAX);
  el.innerHTML = '<span class="release-sw" aria-hidden="true"></span><span>' + esc(msg) + '</span><a href="#/release" data-rel-go="' + go + '">' + t('看開票日') + '</a>';
  el.hidden = false;
}

/* ---------- 我的提醒: the 開票提醒 card ---------- */
// when the cron will send a reminder: 14:05 UTC on its open date, or the next 14:05 UTC run if that has passed
function sendAt(open) {
  const [y, m, d] = open.split('-').map(Number), now = Date.now();
  let at = Date.UTC(y, m - 1, d, 14, 5);
  if (at < now) { const x = new Date(now); at = Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 14, 5); if (at < now) at += 864e5; }
  return new Date(at);
}
function cardHtml(A) {
  sync();
  const list = REM ? REM.reminders.slice().sort((a, b) => (a.open_date < b.open_date ? -1 : a.open_date > b.open_date ? 1 : a.id - b.id)) : [];
  const verified = A && A.mail ? A.mail.state === 'verified' : !!(REM && REM.verified);
  const state = r => {
    if (r.sent_at) return t('已寄出（{0}）', whenShort(r.sent_at));
    if (!verified) return t('還沒寄：Email 還沒驗證');
    const at = sendAt(r.open_date);
    return t('會在 {0} {1} 左右寄出', dayText(isoDate(at)), at.toLocaleTimeString(LOC(), { hour: 'numeric', minute: '2-digit' }));
  };
  const rows = list.map(r => { const p = prog(r.source);
    return '<div class="rowi release-ar"><div class="main"><b>' + logo(p.code) + esc(p.name) + (subOf(r.source) ? '<small class="release-z">' + esc(subOf(r.source)) + '</small>' : '') + '</b>' +
      '<small><span>' + t('搭機 {0}', dayText(r.travel_date, true)) + '</span><span>' + t('開放 {0}', dayText(r.open_date, true)) + '</span>' +
      (r.o && r.d ? '<span>' + esc(routeText(r)) + '</span>' : '') + '</small><span class="st">' + state(r) + '</span></div>' +
      '<div class="acts"><button type="button" class="btn warn" data-rel-del="' + esc(r.id) + '" aria-label="' + esc(t('刪除 {0} {1} 的開票提醒', p.name, dayText(r.travel_date))) + '">' + t('刪除') + '</button></div></div>';
  }).join('');
  return '<h3 tabindex="-1">' + t('開票提醒') + '</h3>' +
    (rows || '<p class="note0">' + t('還沒有開票提醒。到「開票日」頁，在還沒開放的計畫旁按「提醒我」。') + '</p><a class="btn pri release-go" href="#/release">' + t('看開票日') + '</a>') +
    '<p class="note0 release-cn">' + t('開票提醒只會寄到驗證過的 Email，寄出 30 天後會自動移除。') + '</p>';
}
function onAlertsPage(el, A) {
  sync();
  const card = document.createElement('div');
  card.className = 'acard release-card'; card.id = 'release-card';
  el.appendChild(card);
  const draw = () => { if (card.isConnected) card.innerHTML = cardHtml(A); };
  card.innerHTML = REM ? cardHtml(A) : '<h3>' + t('開票提醒') + '</h3><div class="skel"></div>';
  loadRem(!REM || Date.now() - REM_AT > 60000).then(draw, err => {
    if (card.isConnected) card.innerHTML = '<h3>' + t('開票提醒') + '</h3><p class="msg bad">' + esc(t('讀不到你的開票提醒：{0}', err.message)) + '</p>';
  });
  card.addEventListener('click', async e => {
    const b = e.target.closest('[data-rel-del]');
    if (!b || !confirm(t('刪除這個開票提醒？'))) return;
    b.disabled = true;
    const id = +b.dataset.relDel, at = [...card.querySelectorAll('[data-rel-del]')].indexOf(b), me = who();
    try { await call('DELETE', '/me/reminders/' + id); toast(t('開票提醒已刪除')); }
    catch (err) {
      if (err.kind !== 'not_found') { b.disabled = false; toast(err.message); return; }
      toast(t('找不到這個開票提醒，可能已經刪掉了。'));
    }
    sync();
    if (me !== who()) return;
    if (REM) remChange('del', id);
    draw();
    // focus goes to the next reminder's 刪除 (or the one before, or the empty card's link, or the heading)
    const dels = card.querySelectorAll('[data-rel-del]');
    focusOn(dels[Math.min(at, dels.length - 1)] || card.querySelector('.release-go') || card.querySelector('h3'));
  });
}

const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#3E3A39" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="#FFFCF6"/><path d="M3.5 10V8a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v2z" fill="#F2A497"/><path d="M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/></g></svg>';

const CSS = `
/* 開票日 (features/release.js): the travel-date card, the timeline of opening days, the table of programs */
html[lang=en] #view-release .vhead h2{font-size:clamp(18px,5.6vw,23px)}
.release-pick .field{margin:0 0 8px}
.release-pick .df .dv{font-size:22px;line-height:1.3}
.release-pick .note0{margin:0}
.release-stats{display:flex;flex-wrap:wrap;gap:2px 16px;margin:10px 0 0;font-size:14px}
.release-stats b{font-weight:normal;font-size:21px;margin-left:5px;font-variant-numeric:tabular-nums}
.release-all{margin:4px 0 0!important}
.release-pick .release-off{margin:10px 0 0;padding:6px 12px;border:2px solid var(--ink);border-radius:14px;background:var(--coral-t);color:var(--ink)}
.release-acts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}
.release-acts .btn{display:inline-flex;align-items:center;min-height:40px}
.release-done .lbl{margin:0 0 2px}
.release-oline{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:0 12px;padding:7px 0;border-bottom:2px dashed var(--ink)}
.release-oline:last-child{border-bottom:0}
.release-ow{display:flex;flex-direction:column;line-height:1.3;font-variant-numeric:tabular-nums}
.release-od{font-size:14px;white-space:nowrap}
.release-odays{font-size:12px;color:var(--ink2);white-space:nowrap}
.release-onames{display:flex;flex-wrap:wrap;align-content:flex-start;gap:2px 14px;font-size:15px;line-height:1.45;min-width:0}
.release-on{min-width:0;overflow-wrap:anywhere}
.release-on .lg{margin-right:4px}
.tag.release-may{display:inline-block;margin-left:5px;font-size:11px;line-height:17px;padding:0 6px;background:var(--yellow-t);vertical-align:1px}
.release-now{display:flex;align-items:center;gap:8px;margin:14px 0 2px;font-size:14px}
.release-now::before,.release-now::after{content:'';flex:1 1 12px;border-top:3px dotted var(--ink)}
.release-now span{flex:0 0 auto;border:var(--line);border-radius:999px;background:var(--coral);padding:1px 12px;white-space:nowrap}
.release-tlc>.release-now:first-child{margin-top:2px}
.release-tl{list-style:none;margin:0;padding:0}
.release-grp{padding:12px 0 2px}
.release-tl .release-grp+.release-grp,.release-tl+.release-grp,.release-done+.release-grp{border-top:2px dashed var(--ink)}
.release-gh{display:flex;align-items:center;gap:12px}
.release-gt{flex:1;min-width:0;line-height:1.35}
.release-gt b{display:block;font-weight:normal;font-size:17px}
.release-gs{display:flex;flex-wrap:wrap;align-items:center;gap:3px 8px;margin-top:2px}
.release-gs small,.release-gt>small{font-size:12px;color:var(--ink2)}
.release-gt>small{display:block;margin-top:2px}
.release-cd{border:2px solid var(--ink);border-radius:999px;background:var(--yellow-t);padding:0 9px;font-size:12px;line-height:20px;white-space:nowrap}
/* a tear-off calendar page: the month on a coral band, the day big, two binder rings standing on its top edge */
.release-cal{position:relative;flex:0 0 46px;width:46px;margin-top:7px;border:var(--line);border-radius:10px;background:var(--paper);text-align:center;line-height:1}
.release-cal b{display:block;overflow:hidden;border-bottom:var(--line);border-radius:7px 7px 0 0;background:var(--coral);font-weight:normal;font-size:11px;line-height:13px;padding:5px 0 1px;white-space:nowrap}
.release-cal span{display:block;font-size:21px;line-height:27px;font-variant-numeric:tabular-nums}
.release-cal::before,.release-cal::after{content:'';position:absolute;top:-8px;width:3px;height:8px;border:2.5px solid var(--ink);border-radius:4px;background:var(--paper)}
.release-cal::before{left:9px}
.release-cal::after{right:9px}
.release-grp.unk .release-cal{border-style:dashed}
.release-grp.unk .release-cal b{background:var(--yellow-t)}
.release-rows{list-style:none;margin:6px 0 0;padding:0}
.release-row{display:flex;align-items:center;gap:8px;min-height:48px;padding:4px 0}
.release-row+.release-row{border-top:2px dotted #CFC8C3}
.release-row>.lg{flex:0 0 18px;width:18px;height:18px;margin:0}
.release-pn{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:0 6px;line-height:1.3;overflow-wrap:anywhere}
.release-pn>span{font-size:15px}
.release-pn small{font-size:12px;color:var(--ink2)}
.release-pn em{flex-basis:100%;font-style:normal;font-size:12px;color:var(--ink2)}
.btn.release-btn{flex:0 0 auto;display:inline-flex;align-items:center;min-height:40px;padding:2px 14px;font-size:14px;background:var(--yellow)}
.btn.release-btn[disabled]{opacity:.6}
.tag.release-set{flex:0 0 auto;background:var(--green);font-size:12px;line-height:24px;padding:0 10px;white-space:nowrap}
.release-hint{margin:12px 0 0;font-size:13px;color:var(--ink2)}
.release-hint a,.release-note a{position:relative;color:var(--ink);text-underline-offset:3px;white-space:nowrap}
.release-hint a::after,.release-note a::after{content:'';position:absolute;inset:-14px -8px}
.release-rules h3{margin-bottom:4px}
.release-rule{padding:10px 0 0;border-top:2px dashed var(--ink)}
.release-rules .note0{margin-bottom:10px}
.release-rh{display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px}
.release-rh .lg{margin:0}
.release-rh b{font-weight:normal;font-size:16px}
.release-rh small{font-size:12px;color:var(--ink2)}
.release-rd{margin-left:auto;font-size:16px;white-space:nowrap;font-variant-numeric:tabular-nums;background:linear-gradient(transparent 62%,var(--yellow) 62%);padding:0 2px}
.release-rt{margin:6px 0 0;font-size:13px;line-height:1.55}
.release-rt .tag{display:inline-block;margin-right:6px;font-size:11px;line-height:18px;padding:0 7px;vertical-align:1px}
.tag.release-ok{background:var(--green-t)}
.tag.release-fix{background:var(--yellow)}
.tag.release-mix{background:var(--coral-t)}
.release-srcs{display:flex;flex-wrap:wrap;align-items:center;margin:0;font-size:12px;color:var(--ink2)}
.release-srcs span{white-space:pre}
.release-srcs a{display:inline-flex;align-items:center;min-height:40px;color:var(--ink);text-underline-offset:3px}
/* the results calendar: hatched where not every program has opened (rel-partial) or none has (rel-closed);
   the day number and miles keep a solid patch of the day's own colour so they stay readable */
#cal .day.rel-partial{background-image:repeating-linear-gradient(135deg,rgba(62,58,57,.14) 0 2px,transparent 2px 7px)}
#cal .day.rel-closed{background-image:repeating-linear-gradient(135deg,rgba(62,58,57,.26) 0 2px,transparent 2px 6px)}
#cal .day.rel-partial .dn,#cal .day.rel-closed .dn{background-color:inherit;border-radius:6px;padding:0 3px}
#cal .day.rel-partial .dm,#cal .day.rel-closed .dm{background-color:inherit;border-radius:5px}
.release-note{margin:4px 0 0;font-size:12px;line-height:1.6;color:var(--ink2)}
.release-note a{margin-left:6px}
.release-sw{display:inline-block;width:14px;height:14px;margin-right:5px;vertical-align:-3px;border:2px solid var(--ink);border-radius:4px;background:var(--paper) repeating-linear-gradient(135deg,rgba(62,58,57,.32) 0 2px,transparent 2px 5px)}
/* 我的提醒 */
.release-card .rowi .main b .lg{margin:0}
.release-card .release-z{font-size:12px;color:var(--ink2)}
.release-card .st{display:block;font-size:12px;color:var(--ink2);margin-top:2px}
.release-card .rowi .btn,.release-card .release-go{display:inline-flex;align-items:center;min-height:40px}
.release-card .release-go{margin:0 0 8px}
.release-card .release-cn{margin:8px 0 0}
/* focus moved by script after a redraw: a ring for keyboard users only */
.tag.release-set:focus:not(:focus-visible),.release-card h3:focus:not(:focus-visible){outline:none}
`;

addFeature({
  id: 'release',
  title: '開票日',
  route: '#/release',
  back: '#/',
  nav: { tab: 'me', order: 30, label: '開票日', icon: ICON },
  css: CSS,
  en: {
    '開票日': 'Release dates',
    '← 回搜尋': '← Back to search',
    '{0}（{1}）': '{1} {0}',
    '{0} 月': '{1}',
    '、': ', ',
    '刪除': 'Delete',
    '我想搭的日期': 'My travel date',
    '搭機日': 'Travel date',
    '每個計畫在搭機日前固定的天數開放訂位，下面從這天往回算。': 'Each program opens bookings a set number of days before the flight. The list counts back from this date.',
    '請選明天到 {0} 之間的日期。': 'Pick a date from tomorrow to {0}.',
    '已開放': 'Open now',
    '可能已開放': 'Maybe open',
    '還沒開': 'Not yet',
    '這天所有計畫都開放了，可以直接搜尋。': 'Every program is open for this date, so you can search now.',
    '用這天搜尋 {0}': 'Search {0} on this date',
    '可能': 'maybe',
    '約': 'approx.',
    '已開放，現在就能搜尋': 'Open now, ready to search',
    '{0} 起': 'since {0}',
    '{0} 天': '{0} days',
    '今天 {0}': 'Today, {0}',
    '{0}開放': 'Opens {0}',
    '提前 {0} 天': '{0} days ahead',
    '明天開放': 'Tomorrow',
    '倒數 {0} 天': 'In {0} days',
    '不固定': 'Not fixed',
    '大約提前 8 個月，航班表分批放出': 'About 8 months ahead; the schedule opens in batches',
    '提醒信會附上 {0} 的搜尋連結。': 'The email will link to a {0} search.',
    '先在搜尋頁填好出發和抵達，提醒信就會附上搜尋連結。': 'Fill in From and To on the search page first, and the email will link to that search.',
    'Email 還沒驗證，提醒不會寄出。': 'Your email is not verified yet, so reminders will not be sent.',
    '去驗證': 'Verify it',
    '管理開票提醒（{0} 個）': 'Manage release reminders ({0})',
    '讀不到你的開票提醒：{0}': 'Could not load your release reminders: {0}',
    '說法不一：{0} 到 {1} 天': 'Sources disagree: {0} to {1} days',
    '約 {0} 天，只有一個來源': 'About {0} days, one source only',
    '✓ 已設提醒': '✓ Reminder set',
    '提醒我': 'Remind me',
    '{0} 開放時提醒我': 'Remind me when {0} opens',
    '這個計畫已經開放這天的位子了。': 'This program is already open for that date.',
    '開票提醒最多 {0} 個，先刪掉一些再設定。': 'Up to {0} release reminders. Delete one first.',
    '日期或計畫不對。': 'That date or program is not valid.',
    '已設提醒。Email 驗證之後才會寄信（在「我的提醒」）': 'Reminder set. It is sent once your email is verified (see My alerts)',
    '已設提醒：{0} 在 {1} 開放': 'Reminder set: {0} opens on {1}',
    '各計畫提前幾天開放': 'How far ahead each program opens',
    '合作夥伴（其他航空公司）的位子常常比較晚才放出。資料在 {0} 查證，實際開放的日子可能差一兩天。': 'Seats on partner airlines often come out later. Checked on {0}; the real day can be a day or two off.',
    '約 8 個月': 'About 8 months',
    '{0} 到 {1} 天': '{0} to {1} days',
    '約 {0} 天': 'About {0} days',
    '已查證': 'Verified',
    '已更正，原本寫 {0} 天': 'Corrected, was {0} days',
    '說法不一': 'Sources disagree',
    '只有一個來源': 'One source only',
    '各來源：': 'Sources: ',
    '來源：': 'Source: ',
    '還沒有計畫開票': 'No program has opened yet',
    '已開票：{0}/{1} 個計畫': 'Programs open: {0} of {1}',
    '{0}；{1}': '{0}; {1}',
    '這段日期還沒有計畫開票，最早的在 {0} 開放。': 'No program has opened these dates yet. The first opens on {0}.',
    '斜線的日子還沒全部開票：{0} 起只有部分計畫開放，{1} 起都還沒開。': 'Hatched days are not fully open yet: from {0} only some programs are open, and from {1} none are.',
    '斜線的日子還沒全部開票：{0} 起只有部分計畫開放。': 'Hatched days are not fully open yet: from {0} only some programs are open.',
    '看開票日': 'See release dates',
    '已寄出（{0}）': 'Sent {0}',
    '還沒寄：Email 還沒驗證': 'Not sent: email not verified',
    '會在 {0} {1} 左右寄出': 'Sends around {1} on {0}',
    '搭機 {0}': 'Travel {0}',
    '開放 {0}': 'Opens {0}',
    '開票提醒': 'Release reminders',
    '還沒有開票提醒。到「開票日」頁，在還沒開放的計畫旁按「提醒我」。': 'No release reminders yet. On Release dates, tap "Remind me" next to a program that is not open yet.',
    '開票提醒只會寄到驗證過的 Email，寄出 30 天後會自動移除。': 'Release reminders go only to a verified email, and are removed 30 days after they are sent.',
    '刪除這個開票提醒？': 'Delete this release reminder?',
    '刪除 {0} {1} 的開票提醒': 'Delete the {0} reminder for {1}',
    '管理員關閉了這個帳號的提醒功能。': 'The admin turned alerts off for this account.',
    '開票提醒已刪除': 'Release reminder deleted',
    '找不到這個開票提醒，可能已經刪掉了。': 'Reminder not found. It may have been deleted.',
    // the notes on partner seats
    '合作夥伴的位子也要等到 337 天內才看得到，就算對方更早開放。': 'Partner seats also show only inside 337 days, even when the partner opens earlier.',
    '合作夥伴的位子常常比較晚才出現。': 'Partner airline seats often show up later.',
    '用 Miles&Smiles 訂星空聯盟夥伴，可能要到約 331 天才看得到。': 'Star Alliance partners booked with Miles&Smiles may show only from about 331 days.',
    '合作夥伴計畫拿到的新航位子少很多。西雅圖、洛杉磯、舊金山出發的位子在新加坡時間下午 3 點放出。': 'Partner programs get far fewer Singapore seats. Seats from Seattle, LA and San Francisco load at 3pm Singapore time.',
    '其他網站多寫 360 天。合作夥伴計畫要很晚才拿得到漢莎的商務艙和頭等艙。': 'Other tables say 360 days. Partner programs get Lufthansa business and first class much later.',
    'Copa 官方沒有寫。星空聯盟夥伴的位子照各家自己的開放時間。': 'Copa does not publish a window. Star Alliance partner seats follow each airline\'s own release.',
    '各來源差幾天（328 到 331 天）。夥伴航班照各家自己的開放時間。': 'Sources differ by a few days (328 to 331). Partner flights follow each airline\'s own release.',
    '夥伴航班有時比哥倫比亞航空自己的航班更早開放。': 'Partner flights can open earlier than Avianca\'s own flights.',
    '夥伴航班也要等到 331 天內才訂得到，所以國泰、日航、卡達在這裡比較晚出現。': 'Partner flights are bookable only inside 331 days too, so Cathay, JAL and Qatar show up later here.',
    '夥伴航班看兩邊誰比較短：阿拉斯加的 330 天，或對方自己的開放時間。': 'For partner flights, the shorter of Alaska\'s 330 days and the partner\'s own release applies.',
    '夥伴航班最多也是 353 天；捷星約 300 天，阿聯酋約 330 天。': 'Partner flights are capped at 353 days too; Jetstar about 300, Emirates about 330.',
    '英航要晚 6 天（355 天）才訂得到卡達的位子，美國航空和阿拉斯加約 331 天。大部分商務艙只給 Avios 計畫。': 'BA can book Qatar seats only 6 days later (355), American and Alaska at about 331. Most business class goes only to Avios programs.',
    '夥伴航班要等對方放出位子，例如美國航空 331 天。': 'Partner flights open only when that airline releases them, for example American at 331.',
    '官網寫 355 天，但實際上最遠只能訂到第 354 天。夥伴的位子照對方放出的時間。': 'BA says 355 days, but in practice the furthest bookable date is 354 days out. Partner seats follow the partner\'s release.',
    '伊比利亞自己的位子在 iberia.com 比英航官網早 5 天出現。': 'Iberia\'s own seats appear on iberia.com 5 days before ba.com.',
    '夥伴航班要等到 331 天內，而且對方也放出位子，才看得到。': 'Partner flights show once inside 331 days and once the partner has released them.',
    '359 天是法航荷航自己的航班。夥伴比較晚，例如達美 330 天、大韓 351 天。': '359 is for Air France and KLM flights. Partners come later, for example Delta at 330 and Korean Air at 351.',
    '墨西哥國際航空的航班在 331 天放出，所以達美的會員可能比它自己的會員早一天看到。': 'Aeromexico flights load at 331 days, so Delta members may see them a day before Aeromexico members.',
    '北歐航空自己的位子約 330 天才放出；搜尋可以查到約 361 天，所以法航荷航（359 天）等夥伴會先出現。': 'SAS loads its own seats at about 330 days; search reaches about 361, so partners such as Air France and KLM (359) show first.',
    '其他計畫（例如 EuroBonus、Flying Blue）可能比 AlFursan 更早看到沙烏地航空的航班。': 'Other programs (such as EuroBonus and Flying Blue) may show Saudia flights before AlFursan does.',
    '頭等艙多半只留給 Skywards 會員；澳航約 330 天才拿到阿聯酋的位子。': 'First class is mostly kept for Skywards members; Qantas gets Emirates seats at about 330 days.',
    '提前 30 天以上，大部分商務艙和頭等艙只給 Etihad Guest 會員。': 'More than 30 days out, most business and first class seats go only to Etihad Guest members.',
    '維珍澳洲、新航、卡達一開放就有位子；聯合航空常要等到出發前 1 到 2 個月。': 'Virgin Australia, Singapore and Qatar release seats at opening; United often only 1 to 2 months out.',
    '331 天是捷藍自己的航班；夥伴航班沒有可靠的資料。': '331 is for JetBlue flights; there is no reliable data for partner flights.',
    'Azul 可能分批放出航班，比較晚的日期不一定已經有了。': 'Azul may load its schedule in steps, so later dates may not be there yet.',
    '夥伴航班不一定，最多 330 天。': 'On partner airlines it varies, up to 330 days.',
    '沒有夥伴獎勵機票。航班表分批放出，大約提前 8 個月，不是固定天數。': 'No partner awards. The schedule opens in batches, about 8 months ahead, not a fixed number of days.',
  },
  show,
  // signed in (maybe as another account): forget the last account's reminders, and if this page is on screen,
  // draw it again (showApp draws the page before this hook runs)
  onAuth() {
    REM = null; REM_AT = 0; REM_ERR = ''; OPS = []; REM_WHO = who();
    const v = $('#view-release');
    if (v && !v.hidden && $('#release-list')) { drawList(); loadRem().then(drawList, drawList); }
  },
  onRender,
  onAlertsPage,
});
})();
