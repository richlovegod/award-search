// 12 個月 (2026-10-15): one route over the next year, for the owner only (a year of rows costs more quota).
// 查整年 is one seats.aero search from today to today+365 (take 1000, no trips; cabins=<cabin> for premium, business
// and first, none for economy, where nearly every row has seats), paged with the first reply's cursor and skip = rows
// so far minus 5 (an overlap, so a page that shifted loses nothing), at most 4 pages, rows de-duplicated by ID.
// Measured 2026-10-15 on TPE to SEA: business 258 rows on 195 days (1 call); economy about 1,000 rows per 4 months
// (3 calls), pages in date order, page 2 starting with the last 5 IDs of page 1.
// Each page is boiled down as it arrives to every day's programs and miles in the cabin (the raw rows are dropped),
// and that summary is kept in localStorage for 6 hours per route and cabin. Revisits, the 只看直飛 switch (it only picks
// the Direct fields) and tapping a day cost no call. An economy year holds every cabin, so when it was read to the
// end it fills the other cabins too. The search page's options (包含混艙, 包含動態高價位子) apply to the year as well,
// so 看航班細節 shows the same awards; each option set has its own cache entry.
(() => {
  'use strict';
  const DAYS_AHEAD = 365, PAGES = 4, OVERLAP = 5, TTL = 6 * 3600e3, KEEP = 12;
  const KEY = 'award-year:', PREF = 'award-year-pref';
  const ISO = /^\d{4}-\d{2}-\d{2}$/, AIRS = /^[A-Z]{3}(,[A-Z]{3}){0,19}$/, CAB = /^[YWJF]$/;
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#3E3A39" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">' +
    '<rect x="3" y="4.6" width="18" height="16.4" rx="3.6" fill="#FFFCF6"/><path d="M3 9.6V8.2a3.6 3.6 0 0 1 3.6-3.6h10.8A3.6 3.6 0 0 1 21 8.2v1.4z" fill="#A8D3E6"/><path d="M8 2.6v3.6M16 2.6v3.6"/>' +
    '<rect x="6.4" y="12.4" width="5.8" height="5.4" rx="1.6" fill="#B9DAA5"/><path d="M15.4 15.1h2.4"/></g></svg>';
  const Y = { o: '', d: '', c: 'J', direct: !!(load(PREF, {}) || {}).direct, sel: null, busy: null, err: null, body: null, mem: new Map() };

  const owner = () => !!(ME && ME.role === 'owner');
  // the search page's options as a key suffix: '' (seats.aero's defaults), '|m' 包含混艙, '|f' 包含動態高價位子
  const optKey = () => (S.prefs.mixed ? '|m' : '') + (S.prefs.dyn ? '|f' : '');
  const keyOf = (o, d, c, x = optKey()) => KEY + o + '|' + d + '|' + c + x;
  const cabOk = c => CAB.test(c || '');
  const glide = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  const hashOf = (o, d, c) => '#/year?o=' + o + '&d=' + d + '&c=' + c;
  const ymd = iso => +iso.slice(0, 4) + '/' + md(iso);
  const codes = v => String(v || '').toUpperCase().split(/[\s,]+/).filter(x => /^[A-Z0-9]{2}$/.test(x)).slice(0, 4).join(' ');
  const ap = v => (/^[A-Z]{3}$/.test(v || '') ? v : '');
  const shown = () => { const v = $('#view-year'); return !!v && !v.hidden; };

  /* ---------- the year's data: one entry per route and cabin ---------- */
  const newEntry = (o, d, c, s, e, x = '') => ({ v: 1, t: 0, o, d, c, x, s, e, calls: 0, rows: 0, trunc: false, last: '', err: '', from: '', src: [], days: {}, multi: o.includes(',') || d.includes(',') });
  // one row into an entry, under its date: [program index, miles, nonstop miles (0 = no nonstop), airlines,
  // nonstop airlines when they differ, and on multi-airport routes 'TPE YVR']
  function addRow(E, r, k) {
    const m = num(r[k + 'MileageCost']);
    if (!r[k + 'Available'] || !m || !ISO.test(r.Date || '')) return;
    const src = r.Source || (r.Route && r.Route.Source) || '';
    if (!/^[a-z0-9]{2,20}$/.test(src)) return;
    let si = E.src.indexOf(src);
    if (si < 0) si = E.src.push(src) - 1;
    const dm = r[k + 'Direct'] ? num(r[k + 'DirectMileageCost']) || m : 0;
    const air = codes(r[k + 'Airlines']), dair = dm ? codes(r[k + 'DirectAirlines']) : '';
    const x = [si, m, dm, air, dair === air ? '' : dair];
    if (E.multi) x.push(ap(r.Route && r.Route.OriginAirport) + ' ' + ap(r.Route && r.Route.DestinationAirport));
    (E.days[r.Date] = E.days[r.Date] || []).push(x);
    E.rows++;
  }
  // 查整年: every page of the search, each boiled down as it arrives; onPage(pages, last date read) shows progress.
  // Returns the entries: the cabin asked for, plus the other cabins after an economy year read to its end.
  async function fetchYear(o, d, c, onPage) {
    const s = isoDate(new Date()), e = plusDays(s, DAYS_AHEAD), x = optKey();
    const cabs = c === 'Y' ? CABINS.map(v => v.k) : [c], out = {};
    for (const k of cabs) out[k] = newEntry(o, d, k, s, e, x);
    const ids = new Set();
    let cursor = null, pages = 0, more = false, last = '', err = null;
    for (;;) {
      const q = new URLSearchParams({ origin_airport: o, destination_airport: d, start_date: s, end_date: e, take: '1000' });
      if (c !== 'Y') q.set('cabins', CABIN_BY[c].api);
      if (x.includes('|m')) q.set('min_cabin_pct', '50');       // as the search page sends them (readForm, fetchLeg)
      if (x.includes('|f')) q.set('include_filtered', 'true');
      if (pages) { q.set('cursor', String(cursor)); q.set('skip', String(Math.max(0, ids.size - OVERLAP))); }
      let res;
      try { res = await api('/search?' + q); } catch (x) { if (!pages) throw x; err = x; break; }
      pages++;
      if (pages === 1) cursor = res.cursor;
      let fresh = 0;
      for (const r of res.data || []) {
        if (!r || !r.ID || ids.has(r.ID)) continue;
        ids.add(r.ID);
        fresh++;
        if (r.Date > last) last = r.Date;
        for (const k of cabs) addRow(out[k], r, k);
      }
      more = !!res.hasMore;
      if (onPage) onPage(pages, last);
      if (!more || cursor == null || !fresh || pages >= PAGES) break;
    }
    // A cut-off year: pages come in date order, so the last day read often goes on in the page never read. That day
    // counts as not read (its rows are dropped), and last is the day before it, the last day read in full.
    const trunc = !!err || more, at = Date.now(), upto = trunc ? plusDays(last || s, -1) : '';
    for (const k of cabs) {
      const E = out[k], part = trunc && last && E.days[last];
      if (part) { E.rows -= part.length; delete E.days[last]; }
      Object.assign(E, { t: at, calls: k === c ? pages : 0, trunc, last: upto, err: err ? err.message : '', from: k === c ? '' : c });
    }
    if (trunc) for (const k of cabs) if (k !== c) delete out[k];   // a cut-off economy year says nothing sure about the others
    return out;
  }
  function getEntry(o, d, c, x) {
    const k = keyOf(o, d, c, x);
    let E = Y.mem.get(k);
    if (E === undefined) { try { E = JSON.parse(localStorage.getItem(k)); } catch { E = null; } }
    if (!E || E.v !== 1 || !(Date.now() - E.t < TTL)) {
      Y.mem.delete(k);
      if (E) localStorage.removeItem(k);
      return null;
    }
    Y.mem.set(k, E);
    return E;
  }
  // keep an entry for 6 hours; expired year entries go first, then the oldest past KEEP or while storage is full
  function putEntry(E) {
    const k = keyOf(E.o, E.d, E.c, E.x || ''), text = JSON.stringify(E), now = Date.now();
    Y.mem.set(k, E);
    let list = Object.keys(localStorage).filter(x => x.startsWith(KEY) && x !== k).map(x => {
      let at = 0;
      try { at = JSON.parse(localStorage.getItem(x)).t || 0; } catch {}
      return [x, at];
    }).sort((a, b) => a[1] - b[1]);
    for (const [x, at] of list) if (!(now - at < TTL)) localStorage.removeItem(x);
    list = list.filter(([, at]) => now - at < TTL);
    while (list.length >= KEEP) localStorage.removeItem(list.shift()[0]);
    for (;;) {
      try { localStorage.setItem(k, text); return true; } catch {
        if (!list.length) return false;   // memory still has it for this visit
        localStorage.removeItem(list.shift()[0]);
      }
    }
  }

  /* ---------- reading an entry ---------- */
  // each day's lowest award in the cabin (the Direct fields when 只看直飛 is on): m miles, si program, non = nonstop.
  // A day with rows but no nonstop (只看直飛) gets m 0; a day with no rows has no key. Only days from..to count.
  function summarize(E, direct, from, to) {
    const out = new Map();
    for (const iso of Object.keys(E.days)) {
      if ((from && iso < from) || (to && iso > to)) continue;
      let b = null;
      for (const x of E.days[iso]) {
        const v = direct ? x[2] : x[1];
        if (!v) continue;
        const non = direct || (x[2] > 0 && x[2] <= x[1]);
        if (!b || v < b.m || (v === b.m && non && !b.non)) b = { m: v, si: x[0], non };
      }
      out.set(iso, b || { m: 0, si: -1, non: false });
    }
    return out;
  }
  // over the whole year: about the cheapest 10% of days are green, up to about the cheapest third tinted, the rest
  // paper. Days at one price are all in a tier or all out: in when that lands nearer the share (and within half the
  // days), so a common price (185,000 on most nonstop days) does not tint the whole year. The lowest price is always in.
  function cutOf(v, share, floor) {
    const k = v.length * share, c = v[Math.max(0, Math.ceil(k) - 1)];
    let lt = 0, le = 0;
    for (const x of v) { if (x < c) lt++; if (x <= c) le++; }
    const all = !lt || (le - k <= k - lt && le <= v.length / 2);
    return Math.max(all ? c : v[lt - 1], floor);
  }
  function tiersOf(sum) {
    const v = [...sum.values()].map(x => x.m).filter(Boolean).sort((a, b) => a - b);
    if (!v.length) return { best: 0, cheap: 0, min: 0, n: 0 };
    const best = cutOf(v, 0.1, v[0]);
    return { best, cheap: cutOf(v, 1 / 3, best), min: v[0], n: v.length };
  }
  const tierOf = (m, T) => (!m ? '' : m <= T.best ? 'best' : m <= T.cheap ? 'cheap' : 'ok');
  function stateOf(E, sum, iso) {
    const x = sum.get(iso);
    if (x && x.m) return Object.assign({ k: 'has' }, x);
    if (x) return { k: 'nodir' };
    if (E.trunc && E.last && iso > E.last) return { k: 'unread' };
    return { k: 'nodata' };
  }
  // the weeks of a month as rows of 7 (Sunday first), each slot an ISO date or null
  function weeksOf(y, m) {
    const ym = y + '-' + pad(m + 1), days = new Date(y, m + 1, 0).getDate(), out = [];
    let wk = new Array(new Date(y, m, 1).getDay()).fill(null);
    for (let d = 1; d <= days; d++) {
      wk.push(ym + '-' + pad(d));
      if (wk.length === 7) { out.push(wk); wk = []; }
    }
    if (wk.length) out.push(wk.concat(new Array(7 - wk.length).fill(null)));
    return out;
  }
  // the month's cheapest week: the lowest day first, then more days with seats, then the earlier week
  function bestWeek(weeks, sum, from, to) {
    let best = null;
    weeks.forEach((wk, i) => {
      const ds = wk.filter(x => x && x >= from && x <= to), ms = ds.map(x => (sum.get(x) || {}).m || 0).filter(Boolean);
      if (!ms.length) return;
      const w = { i, a: ds[0], b: ds[ds.length - 1], min: Math.min(...ms), n: ms.length };
      if (!best || w.min < best.min || (w.min === best.min && w.n > best.n)) best = w;
    });
    return best;
  }
  const monthsOf = (from, to) => {
    const out = [], a = parseDate(from), b = parseDate(to);
    for (let y = a.getFullYear(), m = a.getMonth(); y < b.getFullYear() || (y === b.getFullYear() && m <= b.getMonth()); m === 11 ? (y++, m = 0) : m++) out.push([y, m]);
    return out;
  };
  const rangeOf = E => { const today = isoDate(new Date()); return [E.s > today ? E.s : today, E.e]; };
  const lowest = (E, direct) => tiersOf(summarize(E, direct, ...rangeOf(E))).min;
  const progName = si => (si >= 0 ? prog(Y.view.E.src[si]).name : '');
  // English needs "1 day" next to "2 days"; the Chinese keys differ only in the number
  const count = (k, one, many) => (k === 1 ? t(one) : t(many, k));

  /* ---------- drawing ---------- */
  const names = list => list.split(',').map(x => AIRPORT_ZH[x] || x).join(t('、'));
  function controlsHtml() {
    // while a year loads every 查整年 waits; only the route loading says 讀取中 (the others say why under the card)
    const E = getEntry(Y.o, Y.d, Y.c), busy = !!Y.busy, mine = busy && Y.busy.key === keyOf(Y.o, Y.d, Y.c);
    // economy, and routes of several airports, often pass 1,000 rows and page
    const cost = Y.c === 'Y' || (Y.o + Y.d).includes(',') ? t('最多用 4 次額度') : t('約用 1 次額度');
    const opts = [S.prefs.mixed ? t('包含混艙') : '', S.prefs.dyn ? t('包含動態高價位子') : ''].filter(Boolean);
    const seg = CABINS.map(c => {
      const x = getEntry(Y.o, Y.d, c.k), low = x ? lowest(x, Y.direct) : 0;
      return '<button type="button" role="radio" data-yc="' + c.k + '" aria-checked="' + (Y.c === c.k) + '">' + esc(c.name) + '<span class="n">' + (x ? (low ? fmtMan(low) : '·') : '') + '</span></button>';
    }).join('');
    return '<div class="acard year-ctl">' +
      '<div class="year-rh"><div class="route-h">' + esc(Y.o.split(',').join('/')) + '<span class="ar">' + PLANE + '</span>' + esc(Y.d.split(',').join('/')) + '</div>' +
        '<button type="button" class="btn ghost year-swap" data-yact="swap" aria-label="' + t('交換出發和抵達') + '">' + t('交換') + '</button></div>' +
      '<p class="year-nm">' + esc(names(Y.o)) + ' → ' + esc(names(Y.d)) + '</p>' +
      '<div class="seg" role="radiogroup" aria-label="' + t('艙等') + '">' + seg + '</div>' +
      '<div class="frow"><label class="switch"><input type="checkbox" id="year-direct"' + (Y.direct ? ' checked' : '') + '><span class="tr"></span><span>' + t('只看直飛') + '</span></label></div>' +
      '<div class="year-go"><button type="button" class="btn pri" data-yact="run"' + (busy ? ' disabled' : '') + '>' + (mine ? t('讀取中…') : E ? t('重新查整年') : t('查整年')) + '</button>' +
        '<span class="year-cost">' + cost + '</span></div>' +
      (opts.length ? '<p class="note0 year-opt">' + t('搜尋選項：{0}', opts.join(t('、'))) + '</p>' : '') +
      (E ? '' : '<p class="note0">' + t('查到的整年資料會在這台裝置留 6 小時，這段時間再打開、切換直飛或點日期都不用額度。') + '</p>') + '</div>';
  }
  function outHtml() {
    const key = keyOf(Y.o, Y.d, Y.c), E = getEntry(Y.o, Y.d, Y.c);
    if (Y.busy && Y.busy.key === key) {
      return '<p class="year-prog" id="year-prog" role="status">' + progText() + '</p><div class="skel"></div><div class="skel"></div>';
    }
    // said above an earlier year too, so a failed 重新查整年 never looks like it worked
    const head = (Y.err && Y.err.key === key ? '<div class="banner bad year-err" role="alert"><b>' + t('查不到') + '</b>' + esc(Y.err.msg) +
        (E ? '<span class="year-was">' + t('{0}查到的結果還在下面。', since(Math.floor(E.t / 1000))) + '</span>' : '') + '</div>' : '') +
      (Y.busy ? '<p class="note0 year-busy">' + t('另一個整年查詢還在讀取，讀完才能再查。') + '</p>' : '');
    if (!E) return head + '<div class="empty">' + MASCOT + t('按「查整年」，看未來 12 個月每天的最低里程。') + '</div>';
    const [from, to] = rangeOf(E), sum = summarize(E, Y.direct, from, to), T = tiersOf(sum);
    Y.view = { E, sum, T, from, to };
    return head + summaryHtml() + overviewHtml() + legendHtml() + '<div class="year-cal" id="year-cal">' + calHtml() + '</div>' +
      '<p class="note">' + t('這是 seats.aero 的快取資料，可能已經過時。轉點數或訂位前，一定要先到航空公司網站確認還有位子。') + '</p>';
  }
  const progText = () => (Y.busy && Y.busy.last ? t('讀取中…已讀到 {0}', ymd(Y.busy.last)) : t('讀取中…'));
  function summaryHtml() {
    const { E, sum, T, from, to } = Y.view, cab = CABIN_BY[E.c].name;
    let has = 0, nodir = 0, nodata = 0, unread = 0, lowDay = '';
    for (let x = from; x <= to; x = plusDays(x, 1)) {
      const st = stateOf(E, sum, x);
      if (st.k === 'has') { has++; if (!lowDay && st.m === T.min) lowDay = x; } else if (st.k === 'nodir') nodir++; else if (st.k === 'unread') unread++; else nodata++;
    }
    let h = '<div class="acard w year-sum">';
    if (lowDay) {
      const x = sum.get(lowDay);
      h += '<p class="year-low">' + (E.trunc ? t('讀到的最低 {0} 哩', '<b>' + n(fmtMiles(T.min)) + '</b>') : t('整年最低 {0} 哩', '<b>' + n(fmtMiles(T.min)) + '</b>')) + '</p>' +
        '<button type="button" class="chip year-lowc" data-yday="' + lowDay + '">' + esc(dayW(lowDay)) + ' ' + esc(progName(x.si)) + (x.non ? '<span class="tag d">' + t('直飛') + '</span>' : '') + '</button>';
    } else h += '<p class="year-low">' + (Y.direct && nodir ? t('這一年沒有{0}的直飛。', esc(cab)) : t('這一年 seats.aero 沒有{0}的資料。', esc(cab))) + '</p>';
    const counts = [count(has, '有位 1 天', '有位 {0} 天'), Y.direct && nodir ? count(nodir, '沒有直飛 1 天', '沒有直飛 {0} 天') : '',
      nodata ? count(nodata, '沒有資料 1 天', '沒有資料 {0} 天') : '', unread ? count(unread, '沒有讀到 1 天', '沒有讀到 {0} 天') : ''].filter(Boolean).join(t('，'));
    const age = since(Math.floor(E.t / 1000));
    const how = E.from ? t('{0}查經濟艙時一起讀到的，沒有另外用額度', age) : E.calls === 1 ? t('{0}查的，用了 1 次額度', age) : t('{0}查的，用了 {1} 次額度', age, E.calls);
    h += '<p class="fresh">' + counts + t('。') + how + '</p>';
    if (E.trunc) h += '<p class="fresh year-cut">' + (E.err ? t('讀到 {0} 就停了：{1}', ymd(E.last), esc(E.err)) : t('結果太多，只讀到 {0}。之後的日子可以點一天，再按「看航班細節」查那一週。', ymd(E.last))) + '</p>';
    return h + '</div>';
  }
  function overviewHtml() {
    const { E, sum, T, from, to } = Y.view, months = monthsOf(from, to);
    return '<div class="year-ov" role="group" aria-label="' + t('每個月的最低里程') + '" style="--yn:' + months.length + '">' + months.map(([y, m], i) => {
      const ym = y + '-' + pad(m + 1);
      let low = 0, any = false;
      for (const [iso, x] of sum) if (iso.startsWith(ym) && iso >= from && iso <= to) { any = true; if (x.m && (!low || x.m < low)) low = x.m; }
      const cls = low ? tierOf(low, T) : E.trunc && ym > E.last.slice(0, 7) ? 'unread' : any ? 'nodir' : 'nodata';
      const mon = t('{0} 月', m + 1, new Date(y, m, 1).toLocaleDateString(LOC(), { month: 'short' }));
      const label = t('{0} 年 {1} 月', y, m + 1, new Date(y, m, 1).toLocaleDateString(LOC(), { month: 'long' })) + t('，') + (low ? t('最低 {0} 哩', fmtMiles(low)) : cls === 'nodir' ? t('沒有直飛') : cls === 'unread' ? t('沒有讀到') : t('沒有資料'));
      return '<button type="button" class="year-mt ' + cls + '" data-ym="' + ym + '" aria-label="' + esc(label) + '"><small>' + (i === 0 || m === 0 || i === months.length - 1 ? y : '') + '</small><span>' + esc(mon) + '</span><b>' + (low ? fmtMan(low) : '·') + '</b></button>';
    }).join('') + '</div>';
  }
  function legendHtml() {
    const k = (cls, x) => '<span><i class="year-k ' + cls + '"></i>' + x + '</span>';
    return '<div class="legend year-lg">' + k('best', t('最便宜，約 10%')) + k('cheap', t('便宜')) + k('ok', t('有位')) + (Y.direct ? k('nodir', t('沒有直飛')) : '') +
      k('nodata', t('沒有資料')) + (Y.view.E.trunc ? k('unread', t('沒有讀到')) : '') + k('bw', t('每月最便宜的一週')) +
      (Y.direct ? '' : '<span>' + t('右上小點：最低價是直飛') + '</span>') + '</div>';
  }
  function calHtml() {
    const { from, to } = Y.view;
    return monthsOf(from, to).map(([y, m]) => monthHtml(y, m)).join('');
  }
  function monthHtml(y, m) {
    const { E, sum, T, from, to } = Y.view, today = isoDate(new Date());
    const ym = y + '-' + pad(m + 1), weeks = weeksOf(y, m), bw = bestWeek(weeks, sum, from, to);
    const title = t('{0} 年 {1} 月', y, m + 1, new Date(y, m, 1).toLocaleDateString(LOC(), { month: 'long' }));
    const inMonth = weeks.flat().filter(x => x && x >= from && x <= to);
    const states = inMonth.map(x => stateOf(E, sum, x));
    const head = bw ? t('最低 {0}', fmtMan(Math.min(...states.filter(x => x.k === 'has').map(x => x.m))))
      : states.some(x => x.k === 'nodir') ? t('沒有直飛') : states.length && states.every(x => x.k === 'unread') ? t('沒有讀到') : t('沒有資料');
    let h = '<section class="year-m" id="year-m-' + ym + '" aria-label="' + esc(title) + '"><div class="year-mh"><h3>' + esc(title) + '</h3><span>' + head + '</span></div>' +
      '<div class="year-wd" aria-hidden="true">' + [...WD].map(w => '<span>' + esc(w) + '</span>').join('') + '</div>';
    weeks.forEach((wk, i) => {
      if (!wk.some(x => x && x >= from && x <= to)) return;   // a week wholly before today (or after the year) takes no room
      const isBw = bw && bw.i === i;
      let row = '';
      if (isBw) {
        const cols = wk.map((x, j) => (x && x >= from && x <= to ? j + 1 : 0)).filter(Boolean);
        row += '<span class="year-band" style="grid-column:' + cols[0] + '/' + (cols[cols.length - 1] + 1) + '" aria-hidden="true"></span>';
      }
      wk.forEach((iso, j) => {
        if (!iso || iso < from || iso > to) { row += '<span class="year-d out" style="grid-column:' + (j + 1) + '" aria-hidden="true"></span>'; return; }
        const st = stateOf(E, sum, iso), dn = +iso.slice(8), sel = Y.sel === iso;
        const cls = (st.k === 'has' ? tierOf(st.m, T) + (st.non && !Y.direct ? ' dir' : '') : st.k) + (sel ? ' sel' : '') + (iso === today ? ' today' : '');
        const label = st.k === 'has' ? t('{0}，最低 {1} 哩，{2}', dayW(iso), fmtMiles(st.m), progName(st.si)) + (st.non ? t('，直飛') : '')
          : st.k === 'nodir' ? t('{0}，沒有直飛', dayW(iso)) : st.k === 'unread' ? t('{0}，沒有讀到', dayW(iso)) : t('{0}，沒有資料', dayW(iso));
        row += '<button type="button" class="year-d ' + cls + '" style="grid-column:' + (j + 1) + '" data-yd="' + iso + '" aria-label="' + esc(label) + '" aria-expanded="' + sel + '"' + (sel ? ' aria-controls="year-dd"' : '') + '>' +
          '<span class="dn">' + dn + '</span><span class="dm">' + (st.k === 'has' ? fmtMan(st.m) : '·') + '</span></button>';
      });
      h += '<div class="year-wk' + (isBw ? ' bw' : '') + '">' + row + '</div>';
      if (Y.sel && wk.includes(Y.sel) && Y.sel >= from && Y.sel <= to) h += dayHtml(Y.sel);
    });
    if (bw) h += '<p class="year-bw"><i aria-hidden="true"></i>' + (bw.a === bw.b ? t('最便宜的一週：{0}，{1}', md(bw.a), fmtMan(bw.min))
      : bw.n === 1 ? t('最便宜的一週：{0} 到 {1}，{2}起，1 天有位', md(bw.a), md(bw.b), fmtMan(bw.min)) : t('最便宜的一週：{0} 到 {1}，{2}起，{3} 天有位', md(bw.a), md(bw.b), fmtMan(bw.min), bw.n)) + '</p>';
    return h + '</section>';
  }
  // the panel under a tapped day: its programs and miles from the loaded year (no call), and 看航班細節
  function dayHtml(iso) {
    const { E, sum, from, to } = Y.view, st = stateOf(E, sum, iso), cab = CABIN_BY[E.c].name, today = isoDate(new Date());
    const list = (E.days[iso] || []).map(x => ({ src: E.src[x[0]], base: x[1], dm: x[2], m: Y.direct ? x[2] : x[1], air: Y.direct ? x[4] || x[3] : x[3], pair: x[5] || '' }));
    const ok = list.filter(x => x.m > 0).sort((a, b) => a.m - b.m || prog(a.src).name.localeCompare(prog(b.src).name));
    let h = '<div class="year-dd" id="year-dd" role="region" aria-label="' + esc(dayW(iso)) + '"><div class="year-ddh"><b>' + esc(dayW(iso)) + '</b><span>' + esc(cab) + (Y.direct ? t('，只看直飛') : '') + '</span>' +
      '<button type="button" class="year-x" data-yact="close" aria-label="' + t('收起這一天') + '">✕</button></div>';
    if (ok.length) {
      h += '<ul class="year-pl">' + ok.map(x => {
        const p = prog(x.src), non = Y.direct || (x.dm > 0 && x.dm <= x.base);
        const tag = non ? '<span class="tag d">' + t('直飛') + '</span>' : x.dm ? '<span class="tag">' + t('直飛另價 {0}', n(fmtMiles(x.dm))) + '</span>' : '<span class="tag">' + t('轉機') + '</span>';
        const who = x.air ? t('實際搭乘：{0}', esc(x.air.split(' ').map(carrierName).join(t('、')))) : '';
        // the program's airline sits on the second line, which wraps, so a long English name is never cut
        return '<li class="year-p"><span class="year-p1">' + logo(p.code) + '<span class="pn">' + esc(p.name) + '</span>' +
          '<b class="year-pm">' + n(fmtMiles(x.m)) + '<small>' + t('哩') + '</small></b></span><span class="year-p2">' + (p.zh ? '<span class="pz">' + esc(p.zh) + '</span>' : '') + tag +
          (x.pair ? '<span>' + esc(x.pair.replace(' ', ' → ')) + '</span>' : '') + (who ? '<span>' + who + '</span>' : '') + '</span></li>';
      }).join('') + '</ul>';
      if (list.length > ok.length) h += '<p class="note0">' + count(list.length - ok.length, '另有 1 個計畫只有轉機。', '另有 {0} 個計畫只有轉機。') + '</p>';
    } else if (st.k === 'nodir') h += '<p class="note0">' + count(list.length, '這天沒有直飛，有 1 個計畫有轉機的位子。', '這天沒有直飛，有 {0} 個計畫有轉機的位子。') + '</p>';
    else if (st.k === 'unread') h += '<p class="note0">' + (E.err ? t('這天沒有讀到：讀完 {0} 之後就出錯停了。', ymd(E.last)) : t('這天沒有讀到：這條航線一整年的結果太多。')) + '</p>';
    else {
      const lastData = Object.keys(E.days).sort().pop() || '';
      h += '<p class="note0">' + (iso > lastData ? t('沒有資料：seats.aero 還沒有這天的資料，常常是因為還沒開放訂這麼遠的日期。') : t('沒有資料：seats.aero 這天沒有{0}的資料。', esc(cab))) + '</p>';
    }
    const s0 = plusDays(iso, -3), s = s0 < today ? today : s0, e = plusDays(iso, 3);
    let near = st.k === 'unread';
    for (let x = s; x <= e && !near; x = plusDays(x, 1)) if (E.days[x]) near = true;
    if (near) h += '<div class="year-dda"><button type="button" class="btn pri" data-yweek="' + iso + '">' + t('看航班細節') + '</button><small>' + t('查 {0} 到 {1} 這一週，約用 1 次額度', md(s), md(e)) + '</small></div>';
    return h + '</div>';
  }
  function draw() {
    const body = Y.body;
    if (!body) return;
    if (!owner()) { body.innerHTML = '<div class="empty">' + MASCOT + t('12 個月一次查一整年，比較耗額度，目前只開放給管理員。') + '</div>'; return; }
    if (!Y.o) {
      body.innerHTML = '<div class="empty">' + MASCOT + t('先在搜尋頁查一條航線，再按結果上方的「12 個月」。') + '</div>';   // the header's back link goes there
      return;
    }
    const a = document.activeElement, keep = a && body.contains(a) ? (a.dataset.yc ? '[data-yc="' + a.dataset.yc + '"]' : a.dataset.yact ? '[data-yact="' + a.dataset.yact + '"]' : a.id ? '#' + a.id : '') : '';
    Y.view = null;
    body.innerHTML = controlsHtml() + '<div id="year-out">' + outHtml() + '</div>';
    if (keep) { const b = body.querySelector(keep); if (b) b.focus({ preventScroll: true }); }
  }
  // a tap on a day: redraw the calendar with its panel, keeping the tapped day where it was on screen
  function select(iso, btn) {
    const cal = $('#year-cal');
    if (!cal || !Y.view) return;
    const before = btn ? btn.getBoundingClientRect().top : null, was = Y.sel;
    Y.sel = iso;
    cal.innerHTML = calHtml();
    if (!iso) {   // closed: the keyboard stays on the day it was opened from
      const b = was && cal.querySelector('[data-yd="' + was + '"]');
      if (b) b.focus({ preventScroll: true });
      return;
    }
    const nb = cal.querySelector('[data-yd="' + iso + '"]');
    if (!nb) return;
    if (before != null) scrollBy(0, nb.getBoundingClientRect().top - before);
    nb.focus({ preventScroll: true });
    const p = $('#year-dd'), r = p && p.getBoundingClientRect(), top = $('.top') ? $('.top').offsetHeight : 64;
    if (r && r.bottom > innerHeight) scrollBy({ top: Math.max(0, Math.min(r.bottom - innerHeight + 12, nb.getBoundingClientRect().top - top - 12)), behavior: glide() });
  }
  function jumpTo(el) { if (el) el.scrollIntoView({ behavior: glide(), block: 'start' }); }
  async function run() {
    if (Y.busy || !owner() || !Y.o) return;
    const o = Y.o, d = Y.d, c = Y.c, x = optKey(), key = keyOf(o, d, c, x);
    Y.busy = { key, last: '' };
    Y.err = null;
    Y.sel = null;
    draw();
    try {
      const got = await fetchYear(o, d, c, (pages, last) => {
        Y.busy.last = last;
        const el = $('#year-prog');
        if (el && keyOf(Y.o, Y.d, Y.c) === key) el.textContent = progText();
      });
      const mine = got[c], old = getEntry(o, d, c, x);
      // a later page failed, and the earlier year is complete (or was read further): keep it, and say what went wrong
      if (mine.err && old && !(old.trunc && old.last < mine.last)) Y.err = { key, msg: mine.err };
      else for (const k of Object.keys(got)) putEntry(got[k]);
    } catch (err) {
      if (err.kind !== 'auth') Y.err = { key, msg: err.message };
    } finally {
      Y.busy = null;
      if (shown()) draw();
    }
  }
  // 看航班細節: the main search for that week (the day 3 days either side, never before today) in this cabin
  function openWeek(iso) {
    const today = isoDate(new Date()), s0 = plusDays(iso, -3), s = s0 < today ? today : s0, e = plusDays(iso, 3);
    Object.assign(S.prefs, { cabin: Y.c, direct: Y.direct });
    savePrefs();
    $('#direct').checked = S.prefs.direct;
    location.hash = '#/';
    route();
    fillForm({ o: Y.o, d: Y.d, s, e });
    const p = readForm();
    if (!p) return;
    runSearch(p, false, true).then(() => { if (S.search === p && S.rows && iso >= S.params.s && iso <= S.params.e) { S.day = iso; render(); } });
  }
  function bind(body) {
    if (body.dataset.yb) return;
    body.dataset.yb = '1';
    body.addEventListener('click', e => {
      const c = e.target.closest('[data-yc]');
      if (c) {
        if (c.dataset.yc === Y.c) return;
        Object.assign(Y, { c: c.dataset.yc, sel: null, err: null });
        history.replaceState(null, '', location.pathname + location.search + hashOf(Y.o, Y.d, Y.c));
        draw();
        return;
      }
      const a = e.target.closest('[data-yact]');
      if (a) {
        if (a.dataset.yact === 'run') run();
        else if (a.dataset.yact === 'close') select(null);
        else if (a.dataset.yact === 'swap') {
          Object.assign(Y, { o: Y.d, d: Y.o, sel: null, err: null });
          history.replaceState(null, '', location.pathname + location.search + hashOf(Y.o, Y.d, Y.c));
          draw();
        }
        return;
      }
      const dd = e.target.closest('[data-yd]');
      if (dd) { select(Y.sel === dd.dataset.yd ? null : dd.dataset.yd, dd); return; }
      const low = e.target.closest('[data-yday]');
      if (low) {
        select(low.dataset.yday);
        const b = $('#year-cal [data-yd="' + low.dataset.yday + '"]');
        if (b) b.scrollIntoView({ behavior: glide(), block: 'center' });
        return;
      }
      const mt = e.target.closest('[data-ym]');
      if (mt) { jumpTo(document.getElementById('year-m-' + mt.dataset.ym)); return; }
      const wk = e.target.closest('[data-yweek]');
      if (wk) openWeek(wk.dataset.yweek);
    });
    body.addEventListener('change', e => {
      if (e.target.id !== 'year-direct') return;
      Y.direct = e.target.checked;
      save(PREF, { direct: Y.direct });
      draw();
    });
  }

  /* ---------- the 12 個月 button next to 收藏 (owner only) ---------- */
  // a line icon like the other result tools (收藏, 提醒, 分享, CSV)
  const BTN_ICON = '<svg class="bi" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#3E3A39" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v15.5h16"/><path d="M7.5 15l3.8-4.6 3 2.6 5-6.3"/></g></svg>';
  const btnHash = () => hashOf(S.params.o, S.params.d, cabOk(S.prefs.cabin) ? S.prefs.cabin : 'J');
  function ensureBtn() {
    const saveBtn = document.getElementById('save-btn');
    if (!saveBtn || !saveBtn.parentNode) return;
    let a = document.getElementById('year-btn');
    if (!(owner() && S.params && S.rows && !S.demo)) { if (a) a.hidden = true; return; }
    if (!a) {
      a = document.createElement('a');
      a.id = 'year-btn';
      a.className = 'btn ghost';
      saveBtn.insertAdjacentElement('afterend', a);
    }
    a.href = btnHash();
    a.innerHTML = BTN_ICON + '<span>' + esc(t('12 個月')) + '</span>';
    a.hidden = false;
  }
  // the direction and cabin on screen at the moment of the tap (a new search may have started since the last render)
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('#year-btn'); if (a && S.params) a.href = btnHash(); }, true);

  const CSS = `
.year-rh{display:flex;align-items:center;gap:10px}
.year-rh .route-h{flex:1;min-width:0;margin:2px 0 0}
.year-swap{flex:0 0 auto;font-size:14px;padding:4px 14px;min-height:40px}
.year-nm{font-size:12px;color:var(--ink2);margin:0 0 10px;overflow-wrap:anywhere}
.year-ctl .frow{margin-top:10px}
.year-go{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:12px 0 8px}
.year-go .btn{font-size:17px;padding:6px 22px;min-height:44px}
.year-go .btn[disabled]{background:var(--coral-t)}
.year-cost{font-size:13px;color:var(--ink2)}
.year-ctl .note0{margin:0}
.year-ctl .year-opt{margin:0 0 6px}
.year-err{margin:14px 0 0}
.year-was{display:block;margin-top:4px}
.year-busy{margin:14px 2px 0}
.year-prog{font-size:15px;margin:14px 2px 6px}
.year-sum{margin-top:14px}
.year-low{font-size:17px;margin:0 0 6px}
.year-low b{font-size:25px;letter-spacing:-.2px;background:linear-gradient(transparent 62%,var(--yellow) 62%);padding:0 2px}
.year-lowc{min-height:40px;gap:6px;margin:0 0 6px;font-size:15px}
.year-lowc .tag{font-size:11px;line-height:18px}
.year-sum .fresh{font-size:12.5px;margin:2px 0 0;text-wrap:balance}
.year-cut{color:#A33A2A}
.year-ov{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin:14px 0 6px}
@media (min-width:600px){.year-ov{grid-template-columns:repeat(var(--yn,13),minmax(0,1fr))}}
.year-mt{border:2px solid var(--ink);border-radius:12px;background:var(--paper);padding:2px 0 4px;min-width:0;min-height:52px;display:flex;flex-direction:column;align-items:center;line-height:1.2;transition:transform .12s ease-out}
.year-mt:active{transform:scale(.92)}
.year-mt small{font-size:10px;min-height:12px;color:var(--ink2)}
.year-mt span{font-size:12px;white-space:nowrap}
.year-mt b{font-weight:normal;font-size:13px;white-space:nowrap;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
.year-mt.best,.year-d.best,.year-k.best{background:var(--green);box-shadow:inset 0 0 0 1px var(--ink)}
.year-mt.cheap,.year-d.cheap,.year-k.cheap{background:var(--green-t)}
.year-mt.nodir,.year-d.nodir,.year-k.nodir{border:2px dashed #CFC8C3;color:#A39C98;background:var(--paper)}
.year-mt.nodata,.year-d.nodata,.year-k.nodata,.year-mt.unread,.year-d.unread,.year-k.unread{border-color:#D6CFC9;color:#A39C98;background:repeating-linear-gradient(135deg,#ECE6E1 0 3px,#F9F6F3 3px 7px)}
.year-mt.unread,.year-d.unread,.year-k.unread{border-style:dotted;border-color:#A39C98}
.year-mt.nodir span,.year-mt.nodata span,.year-mt.unread span,.year-d.nodir .dn,.year-d.nodata .dn,.year-d.unread .dn{color:var(--ink2)}
.year-k.bw{background:var(--yellow)}
.year-lg{margin:8px 0 4px}
.year-m{margin:18px 0 4px;scroll-margin-top:calc(var(--hh) + 10px)}
.year-mh{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 4px}
.year-mh h3{font-size:18px;margin:0}
.year-mh span{font-size:13px;color:var(--ink2);white-space:nowrap}
.year-wd,.year-wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}
.year-wd{font-size:12px;text-align:center;margin-bottom:3px}
.year-wk{margin-bottom:4px}
.year-wk>*{grid-row:1}
.year-wk.bw{margin:7px 0 10px}
.year-band{background:var(--yellow);border-radius:14px;margin:-4px;box-shadow:0 0 0 2px var(--ink)}
.year-d{position:relative;z-index:1;border:2px solid var(--ink);border-radius:11px;min-height:44px;min-width:0;padding:3px 0 2px;background:var(--paper);display:flex;flex-direction:column;align-items:center;line-height:1.2;transition:transform .12s ease-out}
.year-d:active{transform:scale(.92)}
.year-d .dn{font-size:11px;font-variant-numeric:tabular-nums}
.year-d .dm{font-size:13px;white-space:nowrap;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
.year-d.today .dn{text-decoration:underline;text-underline-offset:2px}
.year-d.dir::after{content:"";position:absolute;top:4px;right:4px;width:6px;height:6px;border-radius:50%;background:var(--ink)}
.year-d.sel{background:var(--coral);box-shadow:inset 0 0 0 1px var(--ink);color:var(--ink);border:2px solid var(--ink)}
.year-d.out{visibility:hidden}
.year-bw{display:flex;align-items:center;gap:6px;font-size:13px;margin:2px 0 0;text-wrap:balance}
.year-bw i,.year-k{flex:0 0 14px}
.year-bw i{width:14px;height:14px;border:2px solid var(--ink);border-radius:4px;background:var(--yellow)}
.year-dd{border:var(--line);border-radius:18px;background:var(--water-t);padding:6px 12px 12px;margin:2px 0 10px;animation:pop .35s var(--pop)}
.year-ddh{display:flex;align-items:center;gap:8px}
.year-ddh b{font-weight:normal;font-size:17px;white-space:nowrap}
.year-ddh span{flex:1;min-width:0;font-size:13px;color:var(--ink2)}
.year-x{flex:0 0 40px;width:40px;height:40px;border:2px solid var(--ink);border-radius:50%;background:var(--paper);font-size:15px;padding:0}
.year-x:active{transform:scale(.92)}
.year-pl{list-style:none;margin:2px 0 0;padding:0}
.year-p{padding:7px 0 8px;border-bottom:2px dashed var(--ink)}
.year-p:last-child{border-bottom:0}
.year-p1{display:flex;align-items:baseline;gap:6px;min-width:0}
.year-p1 .lg{align-self:center;margin:0}
.year-p1 .pn{font-size:16px;min-width:0;flex:0 1 auto;overflow-wrap:anywhere}
.year-pm{margin-left:auto;font-weight:normal;font-size:19px;white-space:nowrap;font-variant-numeric:tabular-nums;background:linear-gradient(transparent 62%,var(--yellow) 62%);padding:0 2px}
.year-pm small{font-size:12px;margin-left:2px}
.year-p2{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;font-size:12px;color:var(--ink2);margin-top:3px}
.year-dd .note0{margin:8px 0 0}
.year-dda{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-top:10px}
.year-dda .btn{min-height:40px;padding:4px 16px}
.year-dda small{font-size:12px;color:var(--ink2)}
@media (min-width:640px){.year-cal{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 22px;align-items:start}}
@media (max-width:359px){
  .year-ctl{padding:10px 10px 12px}
  .year-ov{gap:3px}
  .year-mt span{font-size:11px}
  .year-mt b{font-size:11px;letter-spacing:-.7px}
  .year-wd,.year-wk{gap:2px}
  .year-d{border-radius:10px}
  .year-d .dm{font-size:11.5px;letter-spacing:-.6px}
  html[lang=en] .year-go .btn{font-size:16px;padding:6px 16px}
}
@media (hover:hover) and (pointer:fine){.year-d:hover,.year-mt:hover{filter:brightness(.97)}}
`;

  addFeature({
    id: 'year',
    title: '12 個月',
    route: /^#\/year(?:\?(.*))?$/,
    back: '#/',
    nav: { tab: 'flights', order: 20, label: '12 個月', icon: ICON },
    css: CSS,
    en: {
      '12 個月': '12 months',
      '查整年': 'Search the year',
      '重新查整年': 'Search again',
      '約用 1 次額度': 'About 1 call',
      '最多用 4 次額度': 'Up to 4 calls',
      '查到的整年資料會在這台裝置留 6 小時，這段時間再打開、切換直飛或點日期都不用額度。': 'The year stays on this device for 6 hours. Until then, opening it again, switching Nonstop only or tapping a day uses no calls.',
      '另一個整年查詢還在讀取，讀完才能再查。': 'Another year search is still loading. Wait for it to finish.',
      '按「查整年」，看未來 12 個月每天的最低里程。': 'Tap "Search the year" to see the lowest miles for every day of the next 12 months.',
      '讀取中…已讀到 {0}': 'Loading… up to {0}',
      '讀到的最低 {0} 哩': 'Lowest found: {0} miles',
      '整年最低 {0} 哩': 'Year low: {0} miles',
      '這一年沒有{0}的直飛。': 'No {0} nonstops this year.',
      '這一年 seats.aero 沒有{0}的資料。': 'seats.aero has no {0} data for this year.',
      '有位 1 天': 'Seats on 1 day',
      '有位 {0} 天': 'Seats on {0} days',
      '沒有直飛 1 天': 'no nonstop on 1 day',
      '沒有直飛 {0} 天': 'no nonstop on {0} days',
      '沒有資料 1 天': 'no data on 1 day',
      '沒有資料 {0} 天': 'no data on {0} days',
      '沒有讀到 1 天': 'not loaded on 1 day',
      '沒有讀到 {0} 天': 'not loaded on {0} days',
      '搜尋選項：{0}': 'Search options: {0}',
      '{0}查到的結果還在下面。': 'The year fetched {0} is still below.',
      '這天沒有讀到：讀完 {0} 之後就出錯停了。': 'Not loaded: the search stopped with an error after {0}.',
      '，': ', ',
      '{0}查經濟艙時一起讀到的，沒有另外用額度': 'Came with the economy year fetched {0}, no extra calls',
      '{0}查的，用了 1 次額度': 'Fetched {0}, 1 call',
      '{0}查的，用了 {1} 次額度': 'Fetched {0}, {1} calls',
      '讀到 {0} 就停了：{1}': 'Stopped at {0}: {1}',
      '結果太多，只讀到 {0}。之後的日子可以點一天，再按「看航班細節」查那一週。': 'Too many results: read up to {0}. For later dates, tap a day and then "See flights" for that week.',
      '每個月的最低里程': 'Lowest miles each month',
      '最低 {0} 哩': 'from {0} miles',
      '沒有直飛': 'No nonstop',
      '沒有讀到': 'Not loaded',
      '沒有資料': 'No data',
      '最便宜，約 10%': 'Cheapest, about 10%',
      '每月最便宜的一週': 'Cheapest week of the month',
      '右上小點：最低價是直飛': 'Dot at top right: the lowest is nonstop',
      '最低 {0}': 'From {0}',
      '{0}，最低 {1} 哩，{2}': '{0}, from {1} miles, {2}',
      '，直飛': ', nonstop',
      '{0}，沒有直飛': '{0}, no nonstop',
      '{0}，沒有讀到': '{0}, not loaded',
      '{0}，沒有資料': '{0}, no data',
      '最便宜的一週：{0}，{1}': 'Cheapest week: {0}, {1}',
      '最便宜的一週：{0} 到 {1}，{2}起，1 天有位': 'Cheapest week: {0} to {1}, from {2}, seats on 1 day',
      '最便宜的一週：{0} 到 {1}，{2}起，{3} 天有位': 'Cheapest week: {0} to {1}, from {2}, seats on {3} days',
      '，只看直飛': ', nonstop only',
      '收起這一天': 'Close this day',
      '另有 1 個計畫只有轉機。': '1 more program has connections only.',
      '另有 {0} 個計畫只有轉機。': '{0} more programs have connections only.',
      '這天沒有直飛，有 1 個計畫有轉機的位子。': 'No nonstop this day; 1 program has connecting seats.',
      '這天沒有直飛，有 {0} 個計畫有轉機的位子。': 'No nonstop this day; {0} programs have connecting seats.',
      '這天沒有讀到：這條航線一整年的結果太多。': 'Not loaded: this route has too many results for one year.',
      '沒有資料：seats.aero 還沒有這天的資料，常常是因為還沒開放訂這麼遠的日期。': 'No data: seats.aero has nothing for this day yet, often because bookings are not open this far ahead.',
      '沒有資料：seats.aero 這天沒有{0}的資料。': 'No data: seats.aero has no {0} data for this day.',
      '看航班細節': 'See flights',
      '查 {0} 到 {1} 這一週，約用 1 次額度': 'Searches {0} to {1}, about 1 call',
      '12 個月一次查一整年，比較耗額度，目前只開放給管理員。': 'The 12-month view searches a whole year at once and uses more of the quota, so for now it is open to the owner only.',
      '先在搜尋頁查一條航線，再按結果上方的「12 個月」。': 'Search a route first, then tap "12 months" above the results.',
    },
    show(match, body) {
      Y.body = body;
      bind(body);
      const q = new URLSearchParams(match[1] || '');
      let o = String(q.get('o') || '').toUpperCase(), d = String(q.get('d') || '').toUpperCase(), c = q.get('c');
      if (!AIRS.test(o) || !AIRS.test(d)) {
        const p = S.params || S.search || load('award-last', null);
        [o, d] = p && AIRS.test(p.o || '') && AIRS.test(p.d || '') ? [p.o, p.d] : ['', ''];
      }
      if (!cabOk(c)) c = cabOk(S.prefs.cabin) ? S.prefs.cabin : 'J';   // never a lookup on CABIN_BY ('constructor' is in every object)
      if (o !== Y.o || d !== Y.d || c !== Y.c) Object.assign(Y, { sel: null, err: null });
      Object.assign(Y, { o, d, c });
      if (o && owner()) history.replaceState(null, '', location.pathname + location.search + hashOf(o, d, c));
      draw();
    },
    onRender() { ensureBtn(); },
    onAuth() { ensureBtn(); },
    // for tests: the pure parts
    _test: { addRow, newEntry, fetchYear, getEntry, putEntry, summarize, cutOf, tiersOf, tierOf, optKey, weeksOf, bestWeek, monthsOf, keyOf, state: Y },
  });
})();
