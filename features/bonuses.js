// 轉點加碼 (transfer bonuses), Gino 2026-10-15. For a while a bank (or Marriott) can give extra miles when points
// move to an airline program, e.g. Amex to Flying Blue +25% until 11/15. The owner adds them in a card on the admin
// page; everyone gets them from GET /bonuses (no seats.aero call) at every sign-in, painted first from the copy kept
// in localStorage; a render or a return to the screen asks again once that copy is an hour old. A result card
// whose program has a bonus running today gets a coupon-style badge, and its details show, under each bank in the
// 用點數換 block, the points needed with the bonus (and bonuses still to come, so a transfer can wait for one).
// Dates are US Eastern calendar days, wherever the person is: banks start and end their bonuses at midnight Eastern,
// and a transfer can't be undone, so a Taiwan phone must not show a bonus before it starts at the bank.
// No page of its own and no navigation entry: only hooks (onAuth, onRender, onDetails, onAdminPage).
(() => {
  'use strict';
  const KEY = 'award-bonuses';             // localStorage: { at: ms of the fetch, list }
  const FRESH_MS = 3600e3;                 // GET again after an hour
  const RETRY_MS = 600e3;                  // after a failed GET (say the Worker is not updated yet), wait 10 minutes
  const STALE_MS = 7 * 86400e3;            // a copy older than a week is not used at all
  const MAX = 50;                          // the Worker keeps at most this many running or coming up
  const REF = 300000;                      // miles of the transfer used to rank banks with different ratios
  let LIST = null;                         // [{ id, bank, source, pct, start, end, note }], null until known
  let AT = 0;                              // when LIST was fetched (ms)
  let LOADING = null;                      // the GET in flight
  let FAILED = 0;                          // when the last GET failed (ms), 0 after a good one
  let WRITES = 0;                          // owner changes answered (and forced re-reads) so far: a GET sent before one is dropped
  let BUSY = false;                        // an owner change in flight: the add and delete buttons wait for its answer
  const FORM = { bank: 'amex', src: '', pct: '', note: '', start: '', end: '' };   // the admin form, kept across redraws

  const ok = b => b && Number.isInteger(b.id) && typeof b.bank === 'string' && typeof b.source === 'string' && Number.isInteger(b.pct) &&
    /^\d{4}-\d{2}-\d{2}$/.test(b.start) && /^\d{4}-\d{2}-\d{2}$/.test(b.end);
  function keep(list) {
    LIST = (Array.isArray(list) ? list : []).filter(ok);
    AT = Date.now();
    save(KEY, { at: AT, list: LIST });
  }
  { const c = load(KEY, null); if (c && Array.isArray(c.list) && Date.now() - c.at < STALE_MS) { LIST = c.list.filter(ok); AT = c.at; } }
  // the list from the Worker; force = even when the copy is less than an hour old. A GET that was sent before an
  // owner change was answered is older than that answer, so it is dropped.
  function refresh(force) {
    if (!force && LIST && Date.now() - AT < FRESH_MS) return Promise.resolve(LIST);
    if (!LOADING) {
      const w = WRITES;
      const p = call('GET', '/bonuses').then(r => { FAILED = 0; if (w === WRITES) keep(r.bonuses); return LIST; }, err => { FAILED = Date.now(); throw err; })
        .finally(() => { if (LOADING === p) LOADING = null; });
      LOADING = p;
    }
    return LOADING;
  }
  // a tab or a home-screen app left open for days: once the copy is an hour old, the next render (or the page coming
  // back on screen) asks again, so a change by the owner shows within about an hour; after a failure, 10 minutes later
  function freshen() {
    if (!ME || !getToken() || LOADING || (LIST && Date.now() - AT < FRESH_MS) || Date.now() - FAILED < RETRY_MS) return;
    refresh(false).then(paintAll).catch(() => { /* the badges are extra; the cards stay as they are */ });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') freshen(); });

  // today on the US Eastern calendar (YYYY-MM-DD). In Taiwan a bonus starting 11/1 shows from 13:00 on 11/1 (12:00
  // in summer) and one ending 11/15 shows until 13:00 on 11/16; in Seattle it stops at 21:00 on 11/15. The Worker
  // keeps rows until UTC-12 is past their last day and checks limits from UTC-12 and UTC+14, which always enclose
  // the Eastern date, so everything the page accepts the Worker accepts too.
  const EASTERN = (() => { try { return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { return null; } })();
  function today() {
    const now = new Date();
    if (EASTERN) {
      try { const p = {}; for (const x of EASTERN.formatToParts(now)) p[x.type] = x.value; if (/^\d{4}$/.test(p.year) && /^\d\d$/.test(p.month) && /^\d\d$/.test(p.day)) return p.year + '-' + p.month + '-' + p.day; } catch { /* below */ }
    }
    return new Date(now.getTime() - 5 * 3600e3).toISOString().slice(0, 10);   // no time zone data: Eastern standard time
  }
  const stateOf = (b, d) => (d < b.start ? 'soon' : d > b.end ? 'over' : 'on');
  const bankName = k => BANK_NAME[k] || k;
  const progName = k => (PROGRAMS[k] ? PROGRAMS[k][0] : k);
  const viaName = k => AVIOS_ZH[k] || progName(k);   // 英航 in Chinese, BA in English (the page switches AVIOS_ZH)
  const dayText = iso => (iso.slice(0, 4) === today().slice(0, 4) ? md(iso) : iso.slice(0, 4) + '/' + md(iso));
  const label = b => t('{0} 轉 {1}', bankName(b.bank), progName(b.source)) + ' +' + b.pct + '%';
  // points needed for `miles` with the bonus on top of the bank's ratio b:m; the ratio is scaled to whole numbers
  // (100b : m(100 + pct)), the same as [b, m * (1 + pct / 100)] without floating-point rounding
  const bonusPoints = (miles, bank, src, pct) => { const r = routesTo(src)[bank]; return r ? pointsFor(miles, bank, src, [r[0] * 100, r[1] * (100 + pct)]) : null; };
  // banks run bonuses on direct transfers only. Where the page routes points through an Avios programme first (Chase
  // to Qatar goes through British), the bonus that counts is the one on that first move: a Chase to British bonus
  // also lowers the points for Qatar and Finnair.
  const direct = (bank, src) => { const r = routesTo(src)[bank]; return !!r && !r[3]; };
  const hopOf = (bank, src) => { const r = routesTo(src)[bank]; return !r ? null : r[3] ? r[3].split(',')[0] : src; };
  // miles one point brings with the bonus, from the page's own pointsFor on a big transfer, so a 1:1 bank +25% ranks
  // above Marriott 3:1 +30% (and Marriott's 60k extra counts)
  const RATE = new Map();
  function rateOf(b, src) {
    const k = b.bank + ' ' + src + ' ' + b.pct;
    if (!RATE.has(k)) { const p = bonusPoints(REF, b.bank, src, b.pct); RATE.set(k, p ? REF / p : 0); }
    return RATE.get(k);
  }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  // the bonuses in one state that count for a program's cards: running ones best first (the 我的點數 banks, then the
  // most miles per point, the biggest percent, the soonest to end), coming ones by their first day
  function bonusesFor(src, state, d) {
    const mine = new Set(S.prefs.myBanks || []);
    const list = (LIST || []).filter(b => stateOf(b, d) === state && b.source === hopOf(b.bank, src) && direct(b.bank, b.source));
    return list.sort(state === 'soon' ? (a, b) => cmp(a.start, b.start) || rateOf(b, src) - rateOf(a, src) || a.id - b.id
      : (a, b) => (mine.has(b.bank) - mine.has(a.bank)) || rateOf(b, src) - rateOf(a, src) || b.pct - a.pct || cmp(a.end, b.end) || a.id - b.id);
  }

  // "（到 11/15）" stays on one line; a leading space (English) stays outside, so the line can break before it. In
  // details, where the points are, it names the time zone: "（美東時間 11/15 截止）"
  const until = (b, eastern) => {
    const s = eastern ? t('（美東時間 {0} 截止）', md(b.end)) : t('（到 {0}）', md(b.end)), sp = /^\s*/.exec(s)[0];
    return esc(sp) + '<span class="bonuses-nw">' + esc(s.slice(sp.length)) + '</span>';
  };

  /* ---------- result cards: a coupon when a bonus runs today ---------- */
  // 🎁 Amex 轉 Flying Blue 加碼 25%（到 11/15）; on a card reached through an Avios programme first (src is not
  // b.source), the coupon names that first move: 🎁 Amex 經英航加碼 25%（到 11/15） on a Finnair card
  const couponHtml = (b, src) => '<span class="bonuses-badge">' + esc(src && src !== b.source
    ? t('🎁 {0} 經{1}加碼 {2}%', bankName(b.bank), viaName(b.source), b.pct)
    : t('🎁 {0} 轉 {1} 加碼 {2}%', bankName(b.bank), progName(b.source), b.pct)) + until(b) + '</span>';
  // the best bonus running today, and how many other banks run one to the same program
  function tagsHtml(src, d) {
    const on = bonusesFor(src, 'on', d);
    if (!on.length) return '';
    const others = new Set(on.map(x => x.bank).filter(k => k !== on[0].bank)).size;
    return '<span class="bonuses-tags">' + couponHtml(on[0], src) + (others ? '<span class="bonuses-more">' + esc(t('另有 {0} 家', others)) + '</span>' : '') + '</span>';
  }
  function paintCards() {
    const d = today(), memo = new Map();
    for (const art of $$('#list .offer')) {
      for (const x of art.querySelectorAll('.bonuses-tags')) x.remove();
      const src = art.dataset.src;
      if (!memo.has(src)) memo.set(src, tagsHtml(src, d));
      const html = memo.get(src);
      if (!html) continue;
      const o5 = art.querySelector('.o5'), head = art.querySelector('.ohead');
      if (o5) o5.insertAdjacentHTML('afterend', html); else if (head) head.insertAdjacentHTML('beforeend', html);
    }
  }

  /* ---------- card details: the points with the bonus, under its bank in 用點數換 ---------- */
  // src = the card's program; a bonus on the first Avios move (b.source is not src) says 經英航 (via BA)
  function lineHtml(b, need, d, withBank, src) {
    const soon = stateOf(b, d) === 'soon', pts = fmtMiles(need), bk = bankName(b.bank), on = md(b.start);
    const via = b.source === src ? '' : viaName(b.source);
    const text = via
      ? (withBank
        ? (soon ? t('🎁 {0} {1} 起經{2}加碼 {3}%：{4} 點', bk, on, via, b.pct, pts) : t('🎁 {0} 經{1}加碼 {2}%：{3} 點就夠', bk, via, b.pct, pts))
        : (soon ? t('🎁 {0} 起經{1}加碼 {2}%：{3} 點', on, via, b.pct, pts) : t('🎁 經{0}加碼 {1}%：{2} 點就夠', via, b.pct, pts)))
      : (withBank
        ? (soon ? t('🎁 {0} {1} 起加碼 {2}%：{3} 點', bk, on, b.pct, pts) : t('🎁 {0} 加碼 {1}%：{2} 點就夠', bk, b.pct, pts))
        : (soon ? t('🎁 {0} 起加碼 {1}%：{2} 點', on, b.pct, pts) : t('🎁 加碼 {0}%：{1} 點就夠', b.pct, pts)));
    return '<span class="bonuses-li' + (soon ? ' soon' : '') + '" data-bon="' + b.id + '"><span class="bonuses-cp">' + esc(text) + until(b, true) + '</span>' +
      (b.note ? '<span class="bonuses-note">' + esc(t('備註：{0}', b.note)) + '</span>' : '') + '</span>';
  }
  function paintDetails(art, box) {
    for (const x of box.querySelectorAll('.bonuses-li,.bonuses-xb')) x.remove();
    const src = art.dataset.src, miles = +art.dataset.miles, d = today();
    if (!src || !(miles > 0) || !LIST || !LIST.length) return;
    const list = [...bonusesFor(src, 'on', d), ...bonusesFor(src, 'soon', d)];
    const xfer = box.querySelector('.xfer'), rows = xfer ? [...xfer.querySelectorAll('li')] : [], loose = [];
    for (const b of list) {
      const need = bonusPoints(miles, b.bank, src, b.pct);
      if (!need) continue;
      const li = rows.find(x => { const xb = x.querySelector('.xb'); return xb && xb.textContent === bankName(b.bank); });
      if (!li) { loose.push(lineHtml(b, need, d, true, src)); continue; }
      // under the bank's points, before the bank's own note; several bonuses keep their order
      const note = [...li.children].find(x => x.tagName === 'SMALL');
      if (note) note.insertAdjacentHTML('beforebegin', lineHtml(b, need, d, false, src)); else li.insertAdjacentHTML('beforeend', lineHtml(b, need, d, false, src));
    }
    if (loose.length) (xfer || box).insertAdjacentHTML(xfer ? 'afterend' : 'beforeend', '<div class="bonuses-xb">' + loose.join('') + '</div>');
  }
  function paintAll() {
    paintCards();
    for (const art of $$('#list .offer')) { const box = art.querySelector('.trips'); if (box && box.dataset.loaded) paintDetails(art, box); }
  }

  /* ---------- the owner's card on the admin page ---------- */
  const ERRS = { bonus_many: '加碼最多 {0} 筆，先刪掉一些再新增。', bonus_past: '最後一天已經過了。' };
  const errText = err => (ERRS[err.kind] ? t(ERRS[err.kind], MAX) : err.message);
  const order = { on: 0, soon: 1, over: 2 };
  function rowHtml(b, d) {
    const st = stateOf(b, d), left = st === 'on' ? daysBetween(d, b.end) : null;
    const tag = st === 'on' ? '<span class="tag bonuses-on">' + t('進行中') + '</span>' : st === 'soon' ? '<span class="tag bonuses-soon">' + t('{0} 開始', md(b.start)) + '</span>' : '<span class="tag off">' + t('已結束') + '</span>';
    // the days still open for a transfer, today included (10/15 to 10/25 is 11 days)
    const days = left == null ? '' : left === 0 ? t('今天最後一天') : left === 1 ? t('明天最後一天') : t('還剩 {0} 天可轉', left + 1);
    const bits = [t('{0} 到 {1}', dayText(b.start), dayText(b.end)), days,
      b.note ? esc(t('備註：{0}', b.note)) : '', direct(b.bank, b.source) ? '' : t('這家點數不能直接轉過去，卡片上不會顯示')];
    return '<div class="rowi bonuses-row"><div class="main"><b>' + esc(t('{0} 轉 {1}', bankName(b.bank), progName(b.source))) + '<span class="bonuses-pct">+' + b.pct + '%</span>' + tag + '</b>' +
      '<small>' + bits.filter(Boolean).map(x => '<span>' + x + '</span>').join('') + '</small></div>' +
      '<div class="acts"><button type="button" class="btn warn" data-bon-del="' + b.id + '" aria-label="' + esc(t('刪除') + ' ' + label(b)) + '"' + (BUSY ? ' disabled' : '') + '>' + t('刪除') + '</button></div></div>';
  }
  function listHtml() {
    if (LIST == null) return '<div class="skel"></div>';
    const d = today();
    const items = LIST.slice().sort((a, b) => order[stateOf(a, d)] - order[stateOf(b, d)] ||
      (stateOf(a, d) === 'soon' ? (a.start < b.start ? -1 : a.start > b.start ? 1 : 0) : (a.end < b.end ? -1 : a.end > b.end ? 1 : 0)) || a.id - b.id);
    return items.map(b => rowHtml(b, d)).join('') || '<p class="note0 bonuses-empty">' + t('現在沒有加碼。銀行有轉點加碼時，用下面的表單加進來。') + '</p>';
  }
  // the programs a bank transfers to directly (the page's TRANSFERS, without routes through another programme), by
  // name; in Chinese with the airline's short name, so the longest one still fits a 320 px phone (Virgin Atlantic（維珍）).
  // Programs the bank reaches only through an Avios programme are left out on purpose: banks run bonuses on the first
  // move, so the bonus goes on that programme and those cards count it (viaHint says so under the list).
  function progOptions(bank, sel) {
    const ks = Object.keys(PROGRAMS).filter(k => direct(bank, k)).sort((a, b) => progName(a).localeCompare(progName(b), 'en'));
    const air = k => (LANG === 'en' ? '' : CARRIERS[PROGRAM_CODE[k]] || '');
    return '<option value="">' + t('選一個計畫') + '</option>' + ks.map(k => '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' +
      esc(progName(k) + (air(k) ? t('（{0}）', air(k)) : '')) + '</option>').join('');
  }
  // "Chase 轉卡達、芬航要先經英航：加碼記在英航，那些卡片也會算到。" (one sentence per first stop), as HTML: each name
  // stays on one line (英航 must not break between 英 and 航)
  function viaHint(bank) {
    const by = new Map(), nw = x => '<span class="bonuses-nw">' + esc(x) + '</span>';
    for (const k of Object.keys(PROGRAMS)) { const r = routesTo(k)[bank]; if (r && r[3]) { const hop = r[3].split(',')[0]; by.set(hop, [...(by.get(hop) || []), k]); } }
    const tpl = esc(t('{0} 轉{1}要先經{2}：加碼記在{2}，那些卡片也會算到。'));   // the sentence escaped, then the names put in
    return [...by].map(([hop, ks]) => { const a = [nw(bankName(bank)), ks.map(k => nw(viaName(k))).join(esc(t('、'))), nw(viaName(hop))]; return tpl.replace(/\{(\d)\}/g, (m, i) => a[+i]); }).join(' ');
  }
  const plusDays = (iso, k) => { const x = parseDate(iso); x.setDate(x.getDate() + k); return isoDate(x); };
  function formHtml() {
    const d = today();
    if (FORM.src && !direct(FORM.bank, FORM.src)) FORM.src = '';
    return '<form class="bonuses-form" novalidate><h4>' + t('新增加碼') + '</h4>' +
      '<div><p class="bonuses-lbl" id="bonuses-bank-l">' + t('從哪家轉出') + '</p><div class="bonuses-banks" role="radiogroup" aria-labelledby="bonuses-bank-l">' +
        BANKS.map(([k, name]) => '<button type="button" role="radio" data-bon-bank="' + k + '" aria-checked="' + (k === FORM.bank) + '">' + esc(name) + '</button>').join('') + '</div></div>' +
      '<div><div class="field"><label for="bonuses-src">' + t('轉到哪個計畫') + '</label><select id="bonuses-src">' + progOptions(FORM.bank, FORM.src) + '</select></div>' +
        '<p class="note0 bonuses-hint" id="bonuses-via">' + viaHint(FORM.bank) + '</p></div>' +
      // the whole percent box focuses its input (the input is only as wide as its digits, so % sits right after them)
      '<div class="bonuses-pn"><div class="field bonuses-pctf"><label for="bonuses-pct">' + t('加碼幾 %') + '</label><span class="bonuses-pctin"><input id="bonuses-pct" inputmode="numeric" maxlength="4" autocomplete="off" enterkeyhint="done" placeholder="25" value="' + esc(FORM.pct) + '" style="width:' + pctWidth(FORM.pct) + '"><span aria-hidden="true">%</span></span></div>' +
        '<div class="field"><label for="bonuses-note">' + t('備註（選填）') + '</label><input id="bonuses-note" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="' + t('例：限白金卡') + '" value="' + esc(FORM.note) + '"></div></div>' +
      '<div><div class="bonuses-dd"><div class="field"><label for="bonuses-start">' + t('開始日期') + '</label><input type="date" id="bonuses-start" value="' + esc(FORM.start || d) + '"></div>' +
        '<div class="field"><label for="bonuses-end">' + t('最後一天') + '</label><input type="date" id="bonuses-end" min="' + d + '" max="' + plusDays(d, 365) + '" value="' + esc(FORM.end) + '"></div></div>' +
        '<p class="note0 bonuses-hint">' + t('日期以美東時間為準，跟銀行公告一樣。') + '</p></div>' +
      '<p class="bonuses-preview"></p>' +
      '<div class="acts"><button class="btn pri" type="submit"' + (BUSY ? ' disabled' : '') + '>' + t('新增加碼') + '</button></div><p class="msg" id="bonuses-msg" role="status"></p></form>';
  }
  // the percent input is as wide as what is in it (at least two digits, like the placeholder), so % sits right after
  // the number; a full-width digit counts double
  const pctWidth = v => Math.min(6, Math.max(2, [...String(v)].reduce((w, c) => w + (c.charCodeAt(0) > 255 ? 2 : 1), 0))) + 0.3 + 'ch';
  const pctOf = v => { const s = String(v).replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xFF10)).replace(/[%％\s]/g, ''); return /^\d{1,3}$/.test(s) ? +s : NaN; };
  function readInputs(card) {
    const v = id => card.querySelector('#' + id).value;
    Object.assign(FORM, { src: v('bonuses-src'), pct: v('bonuses-pct'), note: v('bonuses-note'), start: v('bonuses-start'), end: v('bonuses-end') });
  }
  // what the cards will show, once the bank, program, percent and last day are there
  function preview(card) {
    const pct = pctOf(FORM.pct), el = card.querySelector('.bonuses-preview');
    el.innerHTML = FORM.src && pct >= 1 && pct <= 200 && /^\d{4}-\d{2}-\d{2}$/.test(FORM.end) ? esc(t('卡片上會顯示：')) + couponHtml({ bank: FORM.bank, source: FORM.src, pct, end: FORM.end }, FORM.src) : '';
  }
  // the form as a POST body, or the reason it can't be sent yet
  function check() {
    const d = today(), pct = pctOf(FORM.pct), { start, end } = FORM;
    if (!FORM.src) return { err: t('請選要轉到哪個計畫。') };
    if (!(pct >= 1 && pct <= 200)) return { err: t('加碼請填 1 到 200 的整數。') };
    if (!start || !end) return { err: t('請選開始日期和最後一天。') };
    if (end < start) return { err: t('最後一天不能早於開始日期。') };
    if (end < d) return { err: t(ERRS.bonus_past) };
    if (daysBetween(d, end) > 365) return { err: t('最後一天最多只能到一年後。') };
    if (daysBetween(start, d) > 365) return { err: t('開始日期不能早於一年前。') };
    return { body: { bank: FORM.bank, source: FORM.src, pct, start, end, note: FORM.note.trim() } };
  }
  function showList(card) { const el = card && card.querySelector('.bonuses-list'); if (el) el.innerHTML = listHtml(); }
  // the admin card on screen now (a redraw of the admin page while a change is in flight puts up a new one)
  const liveCard = () => document.getElementById('bonuses-admin');
  // ask for the list again, dropping any GET already in flight (it may predate the change)
  function reread() { WRITES++; LOADING = null; return refresh(true); }
  // a POST or DELETE answer carries the new list; without one, ask for it
  async function took(res) { if (res && Array.isArray(res.bonuses)) { WRITES++; keep(res.bonuses); } else await reread(); }
  // one owner change at a time: while one is in flight, every delete button and the add button are off, so two
  // answers can never arrive out of order and a row can't be deleted twice. Rows and forms drawn meanwhile come off too.
  function setBusy(on) {
    BUSY = on;
    for (const x of document.querySelectorAll('#bonuses-admin [data-bon-del], #bonuses-admin .bonuses-form [type=submit]')) x.disabled = on;
  }
  function wire(card) {
    card.addEventListener('click', async e => {
      const pick = e.target.closest('[data-bon-bank]');
      if (pick) {
        readInputs(card);
        FORM.bank = pick.dataset.bonBank;
        for (const x of card.querySelectorAll('[data-bon-bank]')) x.setAttribute('aria-checked', String(x === pick));
        if (FORM.src && !direct(FORM.bank, FORM.src)) FORM.src = '';
        card.querySelector('#bonuses-src').innerHTML = progOptions(FORM.bank, FORM.src);
        card.querySelector('#bonuses-via').innerHTML = viaHint(FORM.bank);
        preview(card);
        return;
      }
      // a tap anywhere in the percent box (beside the narrow input, or on the %) types into it
      if (e.target.closest('.bonuses-pctf') && e.target.id !== 'bonuses-pct') { card.querySelector('#bonuses-pct').focus(); return; }
      const del = e.target.closest('[data-bon-del]');
      if (!del || BUSY) return;
      const id = +del.dataset.bonDel, b = (LIST || []).find(x => x.id === id), at = [...card.querySelectorAll('[data-bon-del]')].indexOf(del);
      if (!confirm(t('刪除「{0}」這個加碼？', b ? label(b) : '#' + id))) return;
      setBusy(true);
      try { await took(await call('DELETE', '/admin/bonuses/' + id)); toast(t('加碼已刪除')); }
      catch (err) { toast(errText(err)); if (err.kind === 'not_found') await reread().catch(() => {}); }
      finally { setBusy(false); }
      const live = liveCard();
      showList(live);
      paintAll();
      // the redraw removed the focused button: keep a screen reader's place on the same row if it is still there,
      // else on the row that moved up into its place, else on the card's heading (only if this card is still up)
      if (live !== card) return;
      const btns = [...card.querySelectorAll('[data-bon-del]')];
      (btns.find(x => +x.dataset.bonDel === id) || btns[Math.min(at, btns.length - 1)] || card.querySelector('h3')).focus();
    });
    // typing updates the preview and clears an old complaint
    const edited = e => { if (e && e.target.id === 'bonuses-pct') e.target.style.width = pctWidth(e.target.value); readInputs(card); preview(card); const m = card.querySelector('#bonuses-msg'); if (m && m.classList.contains('bad')) m.textContent = ''; };
    card.addEventListener('input', edited);
    card.addEventListener('change', edited);
    card.addEventListener('submit', async e => {
      e.preventDefault();
      if (BUSY) return;
      readInputs(card);
      const r = check();
      if (r.err) { setMsg('bonuses-msg', r.err); return; }
      setBusy(true);
      try {
        await took(await call('POST', '/admin/bonuses', r.body));
        Object.assign(FORM, { src: '', note: '' });   // the bank, percent and dates often repeat for the next program
        const live = liveCard();
        if (live) {
          live.querySelector('#bonuses-src').innerHTML = progOptions(FORM.bank, '');
          live.querySelector('#bonuses-note').value = '';
          setMsg('bonuses-msg', '', true);
          preview(live);
          showList(live);
        }
        toast(t('加碼已新增'));
        paintAll();
      } catch (err) { if (liveCard()) setMsg('bonuses-msg', errText(err)); else toast(errText(err)); }
      finally { setBusy(false); }
    });
  }
  function adminCard(el) {
    el.insertAdjacentHTML('beforeend', '<div class="acard bonuses-admin" id="bonuses-admin"><h3 tabindex="-1">' + t('🎁 轉點加碼') + '</h3>' +
      '<p class="note0">' + t('銀行或萬豪點數轉到航空計畫的限時加碼。加在這裡，所有人的結果卡片都會標出來，也會算好加碼後要準備多少點。') + '</p>' +
      '<div class="bonuses-list">' + listHtml() + '</div>' + formHtml() + '</div>');
    const card = el.querySelector('#bonuses-admin');
    wire(card);
    preview(card);
    // always read it fresh here: the owner is about to change it
    refresh(true).then(() => { if (card.isConnected) showList(card); paintAll(); }).catch(err => {
      if (!card.isConnected) return;
      const why = err.kind === 'not_found' ? t('轉點加碼要等 Worker 更新後才能用。') : t('讀不到加碼資料：{0}', err.message);
      card.querySelector('.bonuses-list').innerHTML = '<p class="msg bad">' + esc(why) + '</p>' + (LIST ? listHtml() : '');
    });
  }

  // for other features (the 點數錢包 could count a running bonus): read-only
  window.BONUSES = {
    list: () => (LIST || []).map(b => ({ ...b })),                          // running, coming, or just over (US Eastern dates)
    // the bonuses running today (US Eastern) that count for a program's cards (a bonus on the first Avios move
    // included), best first
    running: src => bonusesFor(src, 'on', today()).map(b => ({ ...b })),
    // points `bank` needs for `miles` of `src` with its best bonus running today (US Eastern), or null when it runs none
    points: (miles, bank, src) => { const b = bonusesFor(src, 'on', today()).find(x => x.bank === bank); return b ? bonusPoints(miles, bank, src, b.pct) : null; },
  };

  addFeature({
    id: 'bonuses',
    title: '轉點加碼',
    route: undefined,
    css: `
/* 轉點加碼: a bonus always reads as a cut-out coupon (dashed ink line on yellow), on cards, in details and for the owner */
.bonuses-tags{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin-top:5px}
.bonuses-badge{display:inline-block;max-width:100%;border:2px dashed var(--ink);border-radius:10px;background:var(--yellow-t);padding:0 8px;font-size:12px;line-height:1.5;color:var(--ink);white-space:normal;overflow-wrap:anywhere;text-align:left}
.bonuses-more{border:2px solid var(--ink);border-radius:999px;background:var(--paper);padding:0 8px;font-size:12px;line-height:1.5;white-space:nowrap}
.bonuses-nw{white-space:nowrap}
.xfer li .bonuses-li{display:block;flex-basis:100%;margin:3px 0 2px}
.bonuses-cp{display:inline-block;max-width:100%;border:2px dashed var(--ink);border-radius:10px;background:var(--yellow-t);padding:0 8px;font-size:13px;line-height:1.5;overflow-wrap:anywhere}
.bonuses-li.soon .bonuses-cp{background:var(--paper);color:var(--ink2)}
.bonuses-note{display:block;font-size:11px;color:var(--ink2);margin:1px 0 0 2px}
.bonuses-xb{display:grid;gap:4px;margin-top:8px}
.bonuses-pct{border:2px dashed var(--ink);border-radius:10px;background:var(--yellow-t);padding:0 7px;font-size:13px;line-height:20px;white-space:nowrap}
.tag.bonuses-on{background:var(--green)}
.tag.bonuses-soon{background:var(--water-t)}
.rowi.bonuses-row .main b{word-break:normal;overflow-wrap:break-word}
.bonuses-row .acts .btn{min-height:40px;padding:2px 14px;font-size:14px}
.bonuses-admin h3:focus{outline:none}
.bonuses-empty{margin:4px 0 0}
.bonuses-form{margin-top:12px;padding-top:12px;border-top:2px dashed var(--ink)}
.bonuses-form h4{margin:0;font-size:17px;font-weight:400}
.bonuses-lbl{font-size:13px;margin:0 0 5px}
.bonuses-banks{display:flex;flex-wrap:wrap;gap:6px}
.bonuses-banks button{flex:1 1 auto;min-height:40px;border:var(--line);border-radius:16px;background:var(--paper);padding:2px 10px;font-size:15px;line-height:1.3;transition:transform .12s ease-out}
.bonuses-banks button:active{transform:scale(.95)}
.bonuses-banks button[aria-checked=true]{background:var(--coral)}
.bonuses-form .field select{display:block;width:100%;min-height:26px;border:0;outline:0;padding:0 22px 0 0;font:inherit;font-size:16px;color:inherit;-webkit-appearance:none;appearance:none;text-overflow:ellipsis;
  background:transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6' fill='none' stroke='%233E3A39' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right center/18px 18px}
.bonuses-form .field input[type=date]{font-size:16px}
.bonuses-pn{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:8px}
.bonuses-dd{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
.bonuses-pctf{cursor:text}
.bonuses-pctin{display:flex;align-items:baseline;gap:3px}
.bonuses-pctin input{flex:0 0 auto;width:2.3ch;max-width:100%;min-width:0}
.bonuses-pctin span{font-size:17px}
.bonuses-hint{margin:4px 2px 0;font-size:12px;line-height:1.45}
.bonuses-hint:empty{display:none}
.bonuses-row .acts .btn:disabled,.bonuses-form .acts .btn:disabled{opacity:.6}
.bonuses-preview{margin:0;font-size:13px;color:var(--ink2)}
.bonuses-preview:empty{display:none}
.bonuses-preview .bonuses-badge{margin:3px 0 0;font-size:13px}
.bonuses-form .acts{display:flex;gap:8px}
.bonuses-form .acts .btn{min-height:44px;padding:4px 22px;font-size:16px}
`,
    en: {
      '轉點加碼': 'Transfer bonuses',
      '🎁 轉點加碼': '🎁 Transfer bonuses',
      '銀行或萬豪點數轉到航空計畫的限時加碼。加在這裡，所有人的結果卡片都會標出來，也會算好加碼後要準備多少點。':
        'Limited-time extra miles for moving bank or Marriott points to an airline program. Add one here and everyone sees it on the result cards, with the points needed after the bonus.',
      '現在沒有加碼。銀行有轉點加碼時，用下面的表單加進來。': 'No bonuses right now. When a bank runs one, add it below.',
      '讀不到加碼資料：{0}': 'Could not load the bonuses: {0}',
      '轉點加碼要等 Worker 更新後才能用。': 'Transfer bonuses work once the Worker is updated.',
      '{0} 轉 {1}': '{0} to {1}',
      '進行中': 'Running',
      '{0} 開始': 'Starts {0}',
      '今天最後一天': 'Last day today',
      '明天最後一天': 'Last day tomorrow',
      '還剩 {0} 天可轉': '{0} days left to transfer',
      '這家點數不能直接轉過去，卡片上不會顯示': 'This bank does not transfer there directly, so cards will not show it',
      '新增加碼': 'Add a bonus',
      '從哪家轉出': 'Points from',
      '轉到哪個計畫': 'To program',
      '選一個計畫': 'Pick a program',
      '加碼幾 %': 'Bonus %',
      '例：限白金卡': 'e.g. Platinum only',
      '開始日期': 'First day',
      '最後一天': 'Last day',
      '卡片上會顯示：': 'Cards will show: ',
      '請選要轉到哪個計畫。': 'Pick the program the points go to.',
      '加碼請填 1 到 200 的整數。': 'Enter a whole number from 1 to 200 for the bonus.',
      '請選開始日期和最後一天。': 'Pick the first and the last day.',
      '最後一天不能早於開始日期。': "The last day can't be before the first day.",
      '最後一天已經過了。': 'The last day has already passed.',
      '最後一天最多只能到一年後。': 'The last day can be at most a year from now.',
      '開始日期不能早於一年前。': "The first day can't be more than a year ago.",
      '加碼最多 {0} 筆，先刪掉一些再新增。': 'Up to {0} bonuses. Delete one first.',
      '加碼已新增': 'Bonus added',
      '加碼已刪除': 'Bonus deleted',
      '刪除「{0}」這個加碼？': 'Delete the bonus "{0}"?',
      '🎁 {0} 轉 {1} 加碼 {2}%': '🎁 {0} to {1} +{2}%',
      '🎁 {0} 經{1}加碼 {2}%': '🎁 {0} +{2}% via {1}',
      '（到 {0}）': ' (until {0})',
      '（美東時間 {0} 截止）': ' (until {0} US Eastern)',
      '{0} 轉{1}要先經{2}：加碼記在{2}，那些卡片也會算到。': '{0} reaches {1} through {2}: add the bonus to {2} and those cards count it too.',
      '日期以美東時間為準，跟銀行公告一樣。': 'Dates are US Eastern, as in the banks\' terms.',
      '另有 {0} 家': '+{0} more',
      '🎁 加碼 {0}%：{1} 點就夠': '🎁 +{0}% bonus: {1} pts',
      '🎁 {0} 起加碼 {1}%：{2} 點': '🎁 +{1}% from {0}: {2} pts',
      '🎁 {0} 加碼 {1}%：{2} 點就夠': '🎁 {0} +{1}% bonus: {2} pts',
      '🎁 {0} {1} 起加碼 {2}%：{3} 點': '🎁 {0} +{2}% from {1}: {3} pts',
      '🎁 經{0}加碼 {1}%：{2} 點就夠': '🎁 +{1}% via {0}: {2} pts',
      '🎁 {0} 起經{1}加碼 {2}%：{3} 點': '🎁 +{2}% via {1} from {0}: {3} pts',
      '🎁 {0} 經{1}加碼 {2}%：{3} 點就夠': '🎁 {0} +{2}% via {1}: {3} pts',
      '🎁 {0} {1} 起經{2}加碼 {3}%：{4} 點': '🎁 {0} +{3}% via {2} from {1}: {4} pts',
    },
    // every sign-in asks the Worker (one D1 read), so a deleted or changed bonus never outlives a new session; the
    // stored copy paints first. The badges are extra: a failed GET leaves the cards as they are.
    onAuth() { paintAll(); refresh(true).then(paintAll).catch(() => {}); },
    onRender() { paintCards(); freshen(); },
    onDetails(art, box) { paintDetails(art, box); },
    onAdminPage(el) { adminCard(el); },
  });
})();
