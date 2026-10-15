// 用量圖 (usage chart for the owner), Gino 2026-10-15: a card on the admin page with the last 14 UTC days of
// seats.aero calls, one bar a day stacked by account, against the key's 1,000 a day (the dashed line). Under the
// chart, the day picked (today until a bar is tapped, or the day buttons are used): its total and each account's
// share. Hotel (rooms.aero) calls get a second, smaller chart with its own key once the Worker has a rooms_usage
// table. Reads GET /admin/usage, which costs no seats.aero call, and keeps the reply for a minute so a quick
// revisit asks nothing (sooner when the admin page's list of accounts no longer matches it).
(() => {
  'use strict';
  const DAYS = 14, CAP = 1000, KEEP_MS = 60 * 1000;
  const MIN_BAND = 14;   // px per day; below it the chart scrolls sideways inside the card instead of shrinking
  // Series fills, near the site's coral, water and yellow, then violet, green and pink. A colour stays with its
  // account while other accounts come and go, so any two can end up touching in a day's stack (an account in
  // between may have no calls that day): every PAIR is kept apart, not only neighbours (dataviz validator against
  // the paper #FFFCF6, all pairs, 2026-10-15: worst colour-blind dE 8.3, normal vision 15.1). Slot 1 is the owner.
  const FILLS = ['#F79495', '#72BEEC', '#D3B137', '#AB8AF9', '#68A157', '#B76F91'];
  const REST = '#E0DCD7';   // other accounts folded together, and deleted ones (apart from every fill: dE 12.5+)
  const PAPER = '#FFFCF6';
  let cache = null, pending = null, seq = 0;   // { at, data }, the request in flight, and which request is newest
  let cur = null;                              // the card on screen: { card, m (its model), ro (ResizeObserver), w }
  let measure = null;

  const fmt = v => Number(v || 0).toLocaleString('en-US');
  const r1 = v => Math.round(v * 10) / 10;
  const textW = (s, px) => {
    try {
      measure = measure || document.createElement('canvas').getContext('2d');
      measure.font = px + 'px ' + getComputedStyle(document.body).fontFamily;
      return measure.measureText(s).width;
    } catch { return s.length * px * 0.62; }
  };
  const topRound = (x, y, w, h, r) => {
    r = Math.max(0, Math.min(r, w / 2, h));
    return 'M' + r1(x) + ',' + r1(y + h) + 'V' + r1(y + r) + 'Q' + r1(x) + ',' + r1(y) + ' ' + r1(x + r) + ',' + r1(y) + 'H' + r1(x + w - r) +
      'Q' + r1(x + w) + ',' + r1(y) + ' ' + r1(x + w) + ',' + r1(y + r) + 'V' + r1(y + h) + 'Z';
  };
  const share = (v, total) => (!total ? '' : !v ? '0%' : v / total < 0.005 ? '<1%' : Math.round(v / total * 100) + '%');
  const joiner = () => (LANG === 'en' ? ', ' : '，');
  const wrapName = s => esc(s).replace(/([@.])/g, '$1<wbr>');
  // the accounts as one string, to tell whether the admin page's list still matches the kept reply
  const sig = list => (Array.isArray(list) ? list : []).map(x => x.id + ' ' + x.email + ' ' + x.role).sort().join('|');
  // when the UTC day starts on this device's clock, e.g. 下午5:00 in Seattle
  const utcStart = () => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toLocaleTimeString(LOC(), { hour: 'numeric', minute: '2-digit' });
  };

  // force: ask again even when a reply is kept or a request is in flight (only the newest one is kept)
  function fetchUsage(force) {
    if (!force && cache && Date.now() - cache.at < KEEP_MS) return Promise.resolve(cache.data);
    if (!force && pending) return pending;
    const my = ++seq;
    const p = call('GET', '/admin/usage?days=' + DAYS)
      .then(data => { if (my === seq) cache = { at: Date.now(), data }; return data; })
      .finally(() => { if (pending === p) pending = null; });
    pending = p;
    return p;
  }

  /* ---------- the reply as series ---------- */
  // Every account with a call in the window is a series, the owner first, then by account id (the stack's order,
  // bottom up). Its colour comes from its place among ALL accounts (the owner first, then by id), round the six
  // fills, so it does not change when another account starts or stops calling or the window moves on; two on one
  // slot (only with more than 6 accounts) take the next free one. Past 6 series the 5 busiest keep a colour and the
  // rest share the grey one.
  function model(d) {
    const days = Array.isArray(d.days) ? d.days : [], n = days.length, inDays = new Set(days);
    const users = new Map((d.users || []).map(u => [u.id, u]));
    const rank = new Map((d.users || []).slice().sort((a, b) => ((b.role === 'owner') - (a.role === 'owner')) || (a.id - b.id)).map((u, i) => [u.id, i]));
    const by = new Map();
    const add = (rows, k) => {
      for (const x of rows || []) {
        if (!inDays.has(x.day) || !(x.calls > 0)) continue;
        if (!by.has(x.user_id)) by.set(x.user_id, { id: x.user_id, f: new Map(), r: new Map(), tf: 0, tr: 0 });
        const s = by.get(x.user_id);
        s[k].set(x.day, (s[k].get(x.day) || 0) + x.calls);
        s['t' + k] += x.calls;
      }
    };
    add(d.calls, 'f');
    add(d.rooms, 'r');
    const known = [...by.values()].filter(s => users.has(s.id)), gone = [...by.values()].filter(s => !users.has(s.id));
    for (const s of known) { const u = users.get(s.id); s.email = String(u.email || ''); s.owner = u.role === 'owner'; }
    known.sort((a, b) => (b.owner - a.owner) || (a.id - b.id));
    let keep = known, folded = [];
    if (known.length > FILLS.length) {
      const busy = new Set(known.slice().sort((a, b) => (b.owner - a.owner) || (b.tf + b.tr - a.tf - a.tr) || (a.id - b.id)).slice(0, FILLS.length - 1).map(s => s.id));
      keep = known.filter(s => busy.has(s.id));
      folded = known.filter(s => !busy.has(s.id));
    }
    const taken = new Set();
    for (const s of keep) {   // keep is in rank order, so an account earlier in the list always gets its own slot
      let slot = rank.get(s.id) % FILLS.length;
      while (taken.has(slot)) slot = (slot + 1) % FILLS.length;
      taken.add(slot);
      s.fill = FILLS[slot];
    }
    // names: the email before the @; two the same get their domain's first part too, and the whole email if
    // that still leaves two alike. Alike among EVERY account, not only the ones drawn: with amy.chen@gmail.com
    // silent (or folded into the grey one), amy.chen@yahoo.com must still not be shown as a bare amy.chen
    const emails = [...users.values()].map(u => String(u.email || ''));
    const local = e => e.split('@')[0] || e;
    const withDomain = e => local(e) + '@' + (e.split('@')[1] || '').split('.')[0];
    const tally = f => { const c = {}; for (const e of emails) c[f(e)] = (c[f(e)] || 0) + 1; return c; };
    const c1 = tally(local), c2 = tally(withDomain);
    const nameOf = e => (c1[local(e)] < 2 ? local(e) : c2[withDomain(e)] < 2 ? withDomain(e) : e);
    const series = keep.map(s => Object.assign(s, { name: nameOf(s.email) }));
    const rest = folded.concat(gone);
    if (rest.length) {
      const g = { id: 'rest', f: new Map(), r: new Map(), tf: 0, tr: 0, owner: false, fill: REST,
        name: folded.length ? t('其他 {0} 個帳號', rest.length) : t('刪掉的帳號') };
      for (const s of rest) for (const k of ['f', 'r']) { for (const [day, v] of s[k]) g[k].set(day, (g[k].get(day) || 0) + v); g['t' + k] += s['t' + k]; }
      series.push(g);
    }
    const dayF = {}, dayR = {};
    for (const s of series) { for (const [day, v] of s.f) dayF[day] = (dayF[day] || 0) + v; for (const [day, v] of s.r) dayR[day] = (dayR[day] || 0) + v; }
    const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    return { days, n, today: days[n - 1], series, dayF, dayR, totF: sum(dayF), totR: sum(dayR), hasRooms: Array.isArray(d.rooms), sel: null };
  }

  /* ---------- the chart (k = 'f' seats.aero, 'r' rooms.aero) ---------- */
  function summary(m, k) {
    const tot = k === 'f' ? m.dayF : m.dayR, total = k === 'f' ? m.totF : m.totR;
    let busy = m.days[0];
    for (const d of m.days) if ((tot[d] || 0) > (tot[busy] || 0)) busy = d;
    const head = k === 'f' ? t('最近 {0} 天每天的 seats.aero 呼叫次數，依帳號堆疊，虛線是每日上限 {1}。', m.n, fmt(CAP))
      : t('最近 {0} 天每天查飯店（rooms.aero）的次數，依帳號堆疊，每日上限 {1}。', m.n, fmt(CAP));
    const who = m.series.filter(s => s['t' + k] > 0).map(s => t('{0}：{1} 次', s.name, fmt(s['t' + k]))).join(joiner());
    return head + ' ' + t('今天 {0} 次，{1} 天合計 {2} 次，最多的一天是 {3}（{4} 次）。', fmt(tot[m.today] || 0), m.n, fmt(total), md(busy), fmt(tot[busy] || 0)) +
      (who ? ' ' + t('各帳號：{0}。', who) : '');
  }
  // a round top for an axis: 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150...
  const niceMax = v => {
    if (v <= 10) return 10;
    const p = 10 ** Math.floor(Math.log10(v));
    return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(x => x * p).find(x => x >= v);
  };
  function chart(m, k, width) {
    const n = m.n, big = k === 'f', H = big ? 176 : 116, top = 22, bottom = H - 28, ph = bottom - top;
    let band = width / n, scroll = false;
    if (band < MIN_BAND) { band = MIN_BAND; scroll = true; }
    const W = band * n, tot = k === 'f' ? m.dayF : m.dayR;
    const peak = Math.max(0, ...m.days.map(d => tot[d] || 0));
    // seats.aero: always against the 1,000 line. Hotels use far fewer calls, so their small chart is scaled to
    // its own busiest day (the axis says how high it goes) until it gets within reach of the limit.
    const capped = big || peak >= CAP / 4;
    const yMax = capped ? Math.max(CAP, peak) : niceMax(peak * 1.15);
    const y = v => bottom - v / yMax * ph;
    const bw = Math.max(5, Math.min(24, Math.round(band * 0.6))), rad = Math.min(5, bw / 2);
    const selI = m.days.indexOf(m.sel || m.today);
    const cx = i => i * band + band / 2;
    // day labels (11/1): every day when they fit, else every 2nd (3rd...) counting back from today, kept inside
    // the chart; the picked day always has one (underlined), and a label that would touch it is left out
    const lab = m.days.map(d => md(d)), lw = lab.map(s => textW(s, 11));
    const widest = Math.max(...lw);
    const step = [1, 2, 3, 4, 5, 6, 7, 10, 14, 15, 20, 30, 60].find(s => s * band >= widest + 6) || n;
    const want = selI >= 0 ? [selI] : [];
    for (let i = n - 1; i >= 0; i -= step) if (i !== selI) want.push(i);
    const placed = [];
    for (const i of want) {
      const x = Math.min(W - lw[i] / 2 - 1, Math.max(lw[i] / 2 + 1, cx(i)));
      if (placed.some(p => x - lw[i] / 2 < p.r + 4 && x + lw[i] / 2 > p.l - 4)) continue;
      placed.push({ i, x, l: x - lw[i] / 2, r: x + lw[i] / 2 });
    }
    // Two layers follow the picked day: its band under the bars, and the day labels with its underline. A pick
    // rewrites only those two; the bars and the tap columns stay, so the column under a dragging finger is never
    // taken out from under it
    const sel = selI >= 0 ? '<rect class="usage-selbg" x="' + r1(selI * band + 1) + '" y="2" width="' + r1(band - 2) + '" height="' + (H - 2) + '" rx="9"/>' : '';
    let s = '';
    if (big) s += '<line class="usage-grid" x1="0" x2="' + r1(W) + '" y1="' + r1(y(CAP / 2)) + '" y2="' + r1(y(CAP / 2)) + '"/>';
    if (!capped) s += '<line class="usage-grid" x1="0" x2="' + r1(W) + '" y1="' + top + '" y2="' + top + '"/>';
    for (let i = 0; i < n; i++) {
      const day = m.days[i], segs = m.series.map(x => [x, x[k].get(day) || 0]).filter(([, v]) => v > 0);
      if (!segs.length) continue;
      const x = cx(i) - bw / 2;
      let yb = bottom, gaps = '';
      segs.forEach(([ser, v], j) => {
        const h = Math.max(3, v / yMax * ph), yt = yb - h;
        s += j === segs.length - 1 ? '<path d="' + topRound(x, yt, bw, h, rad) + '" fill="' + ser.fill + '"/>'
          : '<rect x="' + r1(x) + '" y="' + r1(yt) + '" width="' + bw + '" height="' + r1(h) + '" fill="' + ser.fill + '"/>';
        if (j) gaps += '<rect class="usage-gap" x="' + r1(x) + '" y="' + r1(yb - 1) + '" width="' + bw + '" height="2"/>';
        yb = yt;
      });
      s += gaps + '<path class="usage-out" d="' + topRound(x, yb, bw, bottom - yb, rad) + '"/>';
    }
    s += (capped ? '<line class="usage-cap" x1="0" x2="' + r1(W) + '" y1="' + r1(y(CAP)) + '" y2="' + r1(y(CAP)) + '"/>' : '') +
      '<line class="usage-base" x1="0" x2="' + r1(W) + '" y1="' + bottom + '" y2="' + bottom + '"/>';
    // axis words at the left, just above their line (text baselines); a chart that scrolls keeps them in a layer
    // over the box that stays put, or they would scroll away with the old days
    const yl = [capped ? [y(CAP) - 6, t('每日上限 {0}', fmt(CAP))] : [top - 5, fmt(yMax)]];
    if (big) yl.push([y(CAP / 2) - 5, fmt(CAP / 2)]);
    if (!scroll) for (const [b, w] of yl) s += '<text class="usage-yl" x="2" y="' + r1(b) + '">' + esc(w) + '</text>';
    const yov = scroll ? yl.map(([b, w]) => '<span style="top:' + r1(b - 11) + 'px">' + esc(w) + '</span>').join('') : '';
    let labs = '';
    for (const p of placed) {
      const on = p.i === selI;
      labs += '<text class="usage-xl' + (on ? ' on' : '') + '" x="' + r1(p.x) + '" y="' + (bottom + 17) + '" text-anchor="middle">' + esc(lab[p.i]) + '</text>' +
        (on ? '<rect class="usage-mark" x="' + r1(p.l) + '" y="' + (bottom + 21) + '" width="' + r1(p.r - p.l) + '" height="4" rx="2"/>' : '');
    }
    // a tap anywhere in a day's column picks that day (the columns touch, so a tap anywhere on the chart picks
    // the nearest day)
    let hits = '';
    for (let i = 0; i < n; i++) hits += '<rect class="usage-hit" data-i="' + i + '" x="' + r1(i * band) + '" y="0" width="' + r1(band) + '" height="' + H + '"/>';
    const open = '<svg role="img" aria-label="' + esc(summary(m, k)) + '" width="' + r1(W) + '" height="' + H + '" viewBox="0 0 ' + r1(W) + ' ' + H + '">';
    // key: everything that does not follow the picked day; while it stays the same, a pick swaps sel and labs only
    return { scroll, band, yov, sel, labs, key: open + s + hits,
      html: open + '<g class="usage-selg">' + sel + '</g>' + s + '<g class="usage-labg">' + labs + '</g>' + hits + '</svg>' };
  }

  /* ---------- the card ---------- */
  const dayName = (m, d) => (d === m.today ? null : mdw(d));
  const countLine = (m, d, tot, big) => {
    const v = big ? '<b class="usage-big">' + fmt(tot[d] || 0) + '</b>' : fmt(tot[d] || 0);
    return d === m.today ? t('今天 {0} 次／{1}', v, fmt(CAP)) : t('{0} {1} 次／{2}', dayName(m, d), v, fmt(CAP));
  };
  const headHtml = m => '<p class="usage-now">' + countLine(m, m.sel || m.today, m.dayF, true) + '</p>';
  const chev = d => '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // under the chart, one row of the same height either way, so picking a day never moves the bars: how to pick
  // one (or the way back to today), and a day back / a day on for anyone without a pointer (or a steady finger)
  const actHtml = () => '<div class="usage-act">' +
    '<span class="usage-hint">' + t('點長條，看那天的數字') + '</span>' +
    '<button type="button" class="btn ghost usage-back" data-usage-today hidden>' + t('回到今天') + '</button>' +
    '<span class="usage-step"><button type="button" class="btn ghost usage-prev" data-usage-step="-1" aria-label="' + t('前一天') + '">' + chev('M14.5 5.5 8 12l6.5 6.5') + '</button>' +
    '<button type="button" class="btn ghost usage-next" data-usage-step="1" aria-label="' + t('後一天') + '">' + chev('M9.5 5.5 16 12l-6.5 6.5') + '</button></span></div>';
  // the seats.aero legend: accounts with seats.aero calls in the window (an account that only searched hotels is
  // in the hotel key instead), with the picked day's calls and share
  function legendHtml(m) {
    const d = m.sel || m.today, total = m.dayF[d] || 0;
    return m.series.filter(s => s.tf > 0).map(s => {
      const v = s.f.get(d) || 0;
      return '<li><i style="background:' + s.fill + '" aria-hidden="true"></i><span class="usage-nm"><span>' + wrapName(s.name) + '</span>' +
        (s.owner ? '<span class="tag own">' + t('管理員') + '</span>' : '') + '</span><b>' + fmt(v) + '</b><span class="usage-pc">' + share(v, total) + '</span></li>';
    }).join('');
  }
  // the hotel key: every account in the hotel chart, in the same colours, with the picked day's hotel calls
  function keyHtml(m) {
    const d = m.sel || m.today;
    return m.series.filter(s => s.tr > 0).map(s => '<li><i style="background:' + s.fill + '" aria-hidden="true"></i><span>' + wrapName(s.name) + '</span>' +
      (s.owner ? '<span class="tag own">' + t('管理員') + '</span>' : '') + '<b>' + fmt(s.r.get(d) || 0) + '</b></li>').join('');
  }
  function tableHtml(m, k) {
    const tot = k === 'f' ? m.dayF : m.dayR, who = m.series.filter(s => s['t' + k] > 0);
    const rows = m.days.slice().reverse().map(d => '<tr><th scope="row">' + md(d) + '</th><td>' + fmt(tot[d] || 0) + '</td>' +
      who.map(s => '<td>' + fmt(s[k].get(d) || 0) + '</td>').join('') + '</tr>').join('');
    return '<div class="usage-tw"><table><caption>' + (k === 'f' ? t('機票（seats.aero）') : t('飯店（rooms.aero）')) + '</caption>' +
      '<thead><tr><th scope="col">' + t('日期') + '</th><th scope="col">' + t('合計') + '</th>' + who.map(s => '<th scope="col"><span class="usage-thn">' + wrapName(s.name) + '</span></th>').join('') + '</tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }
  // deleting an account deletes its usage rows too (the Worker's removeUser, and the hotels feature for its own),
  // so its past calls drop out of every day here: say so, or the totals look like less than the key spent
  const note = () => '<p class="note0 usage-note">' + t('只算這個網站用掉的次數（快取不算）。日期以 UTC 計，換日時間是你這邊的{0}。', utcStart()) +
    (LANG === 'en' ? ' ' : '') + t('刪掉帳號時，次數也會一起刪掉。') + '</p>';

  function draw(card, m) {
    const body = card.querySelector('.usage-body');
    const anyF = m.totF > 0, anyR = m.totR > 0;
    if (m.n) card.querySelector('h3').textContent = t('最近 {0} 天的用量', m.n);
    const noF = '<p class="note0">' + t('最近 {0} 天沒有用過 seats.aero。', m.n) + '</p>', noR = '<p class="note0">' + t('這 {0} 天沒有查過飯店。', m.n) + '</p>';
    if (!m.n || (!anyF && !anyR)) {
      body.innerHTML = noF + (m.hasRooms ? noR : '') + note();
      return;
    }
    const plot = k => '<div class="usage-pw"><div class="usage-plot" data-k="' + k + '"></div><div class="usage-yov" aria-hidden="true"></div></div>';
    // the headline and the hotel line are drawn with their numbers already in; the picked day is read out from a
    // hidden live region of its own (see say), empty until a day is picked
    body.innerHTML = '<p class="vh usage-live" aria-live="polite" aria-atomic="true"></p>' +
      (anyF ? '<div class="usage-head">' + headHtml(m) + '</div>' + plot('f') + actHtml() + '<ul class="usage-leg"></ul>' +
        '<p class="usage-sum">' + t('{0} 天合計 {1} 次，平均每天 {2} 次', m.n, fmt(m.totF), fmt(Math.round(m.totF / m.n))) + '</p>' : noF) +
      (m.hasRooms ? '<div class="usage-rooms"><p class="usage-rhead"><span>' + t('飯店（rooms.aero）') + '</span><span class="usage-rnow">' + (anyR ? countLine(m, m.today, m.dayR, false) : '') + '</span></p>' +
        (anyR ? plot('r') + '<ul class="usage-key"></ul>' + (anyF ? '' : actHtml()) : noR) + '</div>' : '') +
      // the open/closed sign is in a span hidden from VoiceOver, which would read CSS content after the name
      '<details class="usage-tv"><summary>' + t('看每天的數字') + '<span class="usage-sign" aria-hidden="true"></span></summary>' + (anyF ? tableHtml(m, 'f') : '') + (anyR ? tableHtml(m, 'r') : '') + '</details>' +
      note();
    for (const box of body.querySelectorAll('.usage-plot')) scrub(box, card);
    update(card, m, true);
    // the day labels are measured in Huninn; if it was still loading, measure again once it is in
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (card.isConnected) update(card, m, false); });
  }
  // write only what changed
  const put = (el, html) => { if (el && el.usageHtml !== html) { el.usageHtml = html; el.innerHTML = html; } };
  // the parts that follow the picked day and the card's width
  function update(card, m, first) {
    const d = m.sel || m.today, i = m.days.indexOf(d);
    put(card.querySelector('.usage-head'), headHtml(m));
    put(card.querySelector('.usage-leg'), legendHtml(m));
    put(card.querySelector('.usage-key'), keyHtml(m));
    put(card.querySelector('.usage-rnow'), m.totR > 0 ? countLine(m, d, m.dayR, false) : '');
    const act = card.querySelector('.usage-act');
    if (act) {
      act.querySelector('.usage-hint').hidden = !!m.sel;
      act.querySelector('.usage-back').hidden = !m.sel;
      // aria-disabled, not disabled: the button keeps the focus when it reaches the first or last day
      act.querySelector('.usage-prev').setAttribute('aria-disabled', String(i <= 0));
      act.querySelector('.usage-next').setAttribute('aria-disabled', String(i >= m.n - 1));
    }
    for (const box of card.querySelectorAll('.usage-plot')) {
      const c = chart(m, box.dataset.k, box.clientWidth || 300), svg = box.querySelector('svg');
      if (svg && box.usageKey === c.key) {
        // the same chart with another day picked: move the band and the underline, leave the bars alone
        svg.querySelector('.usage-selg').innerHTML = c.sel;
        svg.querySelector('.usage-labg').innerHTML = c.labs;
      } else {
        const keep = box.scrollLeft;
        box.usageKey = c.key;
        box.innerHTML = c.html;
        box.nextElementSibling.innerHTML = c.yov;
        box.classList.toggle('usage-scroll', c.scroll);
        if (c.scroll) box.scrollLeft = first ? box.scrollWidth : keep;   // today is on the right
      }
      if (!c.scroll) continue;
      // a day picked with the day buttons may be off to the side: bring its column into view
      const l = i * c.band, r = l + c.band, vw = box.clientWidth;
      if (l < box.scrollLeft) box.scrollLeft = Math.max(0, l - c.band);
      else if (r > box.scrollLeft + vw) box.scrollLeft = r - vw + c.band;
    }
  }
  // quiet: during a sideways drag, nothing is read out until the finger lets go
  function pick(card, m, i, quiet) {
    const d = i == null ? null : m.days[i];
    m.sel = !d || d === m.today ? null : d;
    update(card, m, false);
    if (quiet) clearTimeout(sayT); else say(card, m);
  }
  // The picked day's numbers, read out once the pick settles: 0.4 s after the last tap or day button (three quick
  // presses are read once), or when a drag ends, not once per column on the way. Its own hidden live region, empty
  // until the first pick: nothing is read out when the card draws, and the headline is not read twice.
  let sayT = 0;
  function say(card, m) {
    clearTimeout(sayT);
    sayT = setTimeout(() => {
      const live = card.querySelector('.usage-live'), src = card.querySelector(m.totF > 0 ? '.usage-now' : '.usage-rnow');
      if (!live || !src || !card.isConnected) return;
      live.textContent = (m.totF > 0 ? '' : t('飯店（rooms.aero）') + ' ') + src.textContent.replace(/\s+/g, ' ').trim();
    }, 400);
  }
  let dragEnd = 0;   // when the last sideways drag let go: the click that a mouse sends after it picks nothing
  // A day's column is narrow on a phone (18 px at 320), so besides a tap, a sideways drag on the chart moves the
  // pick from day to day. It starts only once the finger has gone sideways more than up or down, so scrolling
  // the page over the chart picks nothing (touch-action pan-y leaves vertical moves to the page). Not on a chart
  // that scrolls sideways itself.
  function scrub(box, card) {
    let st = null;
    const at = e => {
      const svg = box.querySelector('svg');
      if (!svg || !cur || cur.card !== card) return;
      const r = svg.getBoundingClientRect(), m = cur.m;
      const i = Math.max(0, Math.min(m.n - 1, Math.floor((e.clientX - r.left) / (r.width / m.n))));
      if ((m.sel || m.today) !== m.days[i]) pick(card, m, i, true);
    };
    box.addEventListener('pointerdown', e => {
      st = box.classList.contains('usage-scroll') || (e.pointerType === 'mouse' && e.button !== 0) ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
    });
    box.addEventListener('pointermove', e => {
      if (!st || e.pointerId !== st.id) return;
      if (!st.on) {
        const dx = Math.abs(e.clientX - st.x), dy = Math.abs(e.clientY - st.y);
        if (dx < 6 || dx <= dy) return;
        st.on = true;
        try { box.setPointerCapture(e.pointerId); } catch { /* the drag still works without it */ }
      }
      at(e);
    });
    const end = e => {
      if (!st || e.pointerId !== st.id) return;
      if (st.on) { dragEnd = Date.now(); if (cur && cur.card === card) say(card, cur.m); }
      st = null;
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
  }
  // redraw when the card's width changes (turning the phone), and stop once the card is gone
  function watch(card, m) {
    if (cur && cur.ro) cur.ro.disconnect();
    cur = { card, m, ro: null, w: card.clientWidth };
    if (typeof ResizeObserver !== 'function') return;
    const me = cur;
    me.ro = new ResizeObserver(() => {
      if (!card.isConnected) { me.ro.disconnect(); return; }
      if (card.clientWidth === me.w) return;
      me.w = card.clientWidth;
      update(card, m, false);
    });
    me.ro.observe(card);
  }
  async function load(card, force) {
    const body = card.querySelector('.usage-body');
    let d;
    try { d = await fetchUsage(force); }
    catch (err) {
      if (!card.isConnected) return;
      body.innerHTML = '<p class="msg bad">' + esc(err.kind === 'not_found' ? t('用量圖要等 Worker 更新後才看得到。') : err.message) + '</p>' +
        '<button type="button" class="btn ghost usage-retry" data-usage-retry>' + t('再試一次') + '</button>';
      return;
    }
    if (!card.isConnected) return;
    const m = model(d);
    draw(card, m);
    watch(card, m);
  }

  addFeature({
    id: 'usage',
    css: `
.usage-card .usage-body{min-height:40px}
.usage-head{margin:0 0 4px}
.usage-now{margin:0;font-size:15px;line-height:1.3}
.usage-act{display:flex;align-items:center;gap:8px;min-height:40px;margin:2px 0 0}
.usage-hint{flex:1;min-width:0;font-size:13px;line-height:1.3;color:var(--ink2);text-wrap:balance}
.usage-now .num{font-variant-numeric:normal}
.usage-big{font-size:26px;line-height:1.1;margin:0 2px;font-variant-numeric:normal}
.usage-back,.usage-retry{font-size:13px;padding:0 12px;min-height:40px}
.usage-back{margin-right:auto}
.usage-step{display:flex;gap:6px;margin-left:auto;flex:none}
.usage-step .btn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;padding:0;color:var(--ink)}
.usage-step .btn[aria-disabled=true]{opacity:.35;cursor:default}
.usage-step .btn[aria-disabled=true]:active{transform:none}
.usage-pw{position:relative}
.usage-plot{overflow-x:hidden}
.usage-yov{position:absolute;left:0;top:0;pointer-events:none}
.usage-yov span{position:absolute;left:0;white-space:nowrap;font-size:11px;line-height:13px;color:var(--ink2);background:rgba(255,252,246,.9);border-radius:4px;padding:0 3px 0 2px}
.usage-plot.usage-scroll{overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
.usage-plot svg{display:block;touch-action:pan-y pinch-zoom;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.usage-plot.usage-scroll svg{touch-action:manipulation}
.usage-plot text{font-family:var(--font);font-size:11px;fill:var(--ink2)}
.usage-plot .usage-yl{paint-order:stroke;stroke:var(--paper);stroke-width:3px;stroke-linejoin:round}
.usage-plot .usage-xl.on{fill:var(--ink)}
.usage-selbg{fill:#F4ECDF}
.usage-mark{fill:#E8806F}
.usage-grid{stroke:#E7DFD3;stroke-width:1}
.usage-cap{stroke:var(--ink);stroke-width:2;stroke-dasharray:6 5}
.usage-base{stroke:var(--ink);stroke-width:2}
.usage-gap{fill:${PAPER}}
.usage-out{fill:none;stroke:var(--ink);stroke-width:2;stroke-linejoin:round}
.usage-hit{fill:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent}
@media (hover:hover) and (pointer:fine){.usage-hit:hover{fill:rgba(62,58,57,.05)}}
.usage-leg{list-style:none;margin:6px 0 0;padding:0}
.usage-leg li{display:grid;grid-template-columns:16px minmax(0,1fr) auto 3.3em;align-items:center;gap:0 8px;padding:6px 0;border-bottom:2px dashed var(--ink);font-size:14px;line-height:1.35}
.usage-leg li:last-child{border-bottom:0}
.usage-leg i,.usage-key i{display:block;border:2px solid var(--ink)}
.usage-leg i{width:16px;height:16px;border-radius:5px}
.usage-nm{display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px;min-width:0}
.usage-nm>span:first-child{overflow-wrap:anywhere}
.usage-leg b{font-size:16px;text-align:right;font-variant-numeric:tabular-nums}
.usage-pc{text-align:right;font-size:13px;color:var(--ink2);font-variant-numeric:tabular-nums}
.usage-sum{font-size:13px;color:var(--ink2);margin:4px 0 0}
.usage-rooms{margin-top:12px;padding-top:8px;border-top:2px dashed var(--ink)}
.usage-rhead{display:flex;flex-wrap:wrap;justify-content:space-between;gap:0 10px;margin:0 0 2px;font-size:15px}
.usage-rnow{font-size:14px;color:var(--ink2)}
.usage-key{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;line-height:1.35}
.usage-key li{display:flex;align-items:center;gap:5px;max-width:100%;min-width:0}
.usage-key i{flex:none;width:12px;height:12px;border-radius:4px}
.usage-key li>span:not(.tag){overflow-wrap:anywhere;min-width:0}
.usage-key b{font-variant-numeric:tabular-nums}
.usage-key .tag{font-size:11px;line-height:16px;padding:0 6px}
.usage-tv{margin-top:10px;border-top:2px dashed var(--ink)}
.usage-tv summary{cursor:pointer;font-size:14px;min-height:42px;display:flex;align-items:center;gap:6px;list-style:none}
.usage-tv summary::-webkit-details-marker{display:none}
.usage-sign::after{content:"＋"}
.usage-tv[open] .usage-sign::after{content:"－"}
.usage-tw{overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;margin:0 0 10px}
.usage-tw table{border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums;width:max-content;min-width:100%}
.usage-tw caption{text-align:left;font-size:13px;color:var(--ink2);padding:2px 0 4px}
.usage-tw th,.usage-tw td{padding:3px 6px;text-align:right;white-space:nowrap;border-bottom:1px solid #E7DFD3;font-weight:normal}
.usage-tw thead th{color:var(--ink2);white-space:normal;word-break:keep-all;vertical-align:bottom}
.usage-thn{display:inline-block;max-width:7em;overflow-wrap:anywhere;text-align:right}
.usage-tw tr>:first-child{position:sticky;left:0;background:var(--paper);text-align:left;padding-left:0}
.usage-note{margin:8px 0 0}
`,
    en: {
      '最近 {0} 天的用量': 'Usage, last {0} days',
      '今天 {0} 次／{1}': 'Today: {0} of {1}',
      '{0} {1} 次／{2}': '{0}: {1} of {2}',
      '回到今天': 'Back to today',
      '點長條，看那天的數字': 'Tap a bar to see that day',
      '前一天': 'Previous day',
      '後一天': 'Next day',
      '每日上限 {0}': 'Daily limit {0}',
      '管理員': 'Owner',
      '其他 {0} 個帳號': '{0} other accounts',
      '刪掉的帳號': 'Deleted accounts',
      '{0} 天合計 {1} 次，平均每天 {2} 次': '{0}-day total: {1}, about {2} a day',
      '飯店（rooms.aero）': 'Hotels (rooms.aero)',
      '機票（seats.aero）': 'Flights (seats.aero)',
      '這 {0} 天沒有查過飯店。': 'No hotel searches in these {0} days.',
      '最近 {0} 天沒有用過 seats.aero。': 'No seats.aero calls in the last {0} days.',
      '看每天的數字': 'Numbers for each day',
      '日期': 'Date',
      '合計': 'Total',
      '只算這個網站用掉的次數（快取不算）。日期以 UTC 計，換日時間是你這邊的{0}。': "Counts only this site's calls (cached results are free). Days are UTC days, each starting at {0} your time.",
      '刪掉帳號時，次數也會一起刪掉。': 'Deleting an account deletes its counts too.',
      '最近 {0} 天每天的 seats.aero 呼叫次數，依帳號堆疊，虛線是每日上限 {1}。': 'seats.aero calls per UTC day for the last {0} days, stacked by account. The dashed line is the daily limit of {1}.',
      '最近 {0} 天每天查飯店（rooms.aero）的次數，依帳號堆疊，每日上限 {1}。': 'Hotel (rooms.aero) calls per UTC day for the last {0} days, stacked by account. The daily limit is {1}.',
      '今天 {0} 次，{1} 天合計 {2} 次，最多的一天是 {3}（{4} 次）。': 'Today: {0}. {1}-day total: {2}. Busiest day: {3} ({4}).',
      '各帳號：{0}。': 'By account: {0}.',
      '{0}：{1} 次': '{0} {1}',
      '用量圖要等 Worker 更新後才看得到。': 'The usage chart shows up once the Worker is updated.',
      '再試一次': 'Try again',
    },
    // a new sign-in never sees the last session's reply, nor one still on its way
    onAuth() { cache = null; pending = null; seq++; },
    onAdminPage(el, u) {
      const card = document.createElement('div');
      card.className = 'acard usage-card';
      card.id = 'usage-card';
      card.innerHTML = '<h3>' + t('最近 {0} 天的用量', DAYS) + '</h3><div class="usage-body"><div class="skel" aria-hidden="true"></div></div>';
      el.appendChild(card);
      card.addEventListener('click', e => {
        const m = cur && cur.card === card ? cur.m : null;
        const hit = e.target.closest('.usage-hit');
        // a finger or a mouse (detail 1+). VoiceOver's double-tap on the chart picture sends a click with detail 0
        // to whatever sits at its centre, which would pick the middle day: the day buttons are its way instead
        if (hit) { if (m && e.detail > 0 && Date.now() - dragEnd > 400) pick(card, m, +hit.getAttribute('data-i')); return; }
        const b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-usage-step') && m) {
          if (b.getAttribute('aria-disabled') === 'true') return;
          const i = m.days.indexOf(m.sel || m.today) + Number(b.getAttribute('data-usage-step'));
          if (i >= 0 && i < m.n) pick(card, m, i);
        } else if (b.hasAttribute('data-usage-today') && m) {
          const had = document.activeElement === b;
          pick(card, m, null);
          if (had) { const prev = card.querySelector('.usage-prev'); if (prev) prev.focus(); }   // it hides itself; focus stays in the row
        } else if (b.hasAttribute('data-usage-retry')) {
          card.querySelector('.usage-body').innerHTML = '<div class="skel" aria-hidden="true"></div>';
          load(card, true);
        }
      });
      // the page draws this card again after every admin action; when an account was added or deleted since the
      // kept reply, ask again rather than show the old list for up to a minute
      load(card, !!(cache && u && Array.isArray(u.users) && sig(u.users) !== sig(cache.data.users)));
    },
  });
})();
