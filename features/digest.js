// 每日精選信 (daily digest email), 2026-10-15: a card on 我的提醒. Once a day (8 am in Taiwan or 7 am in Seattle) the
// Worker emails the cheapest nonstop business / first class destinations from the chosen home airports, the top 10
// per airport and cabin, new or cheaper ones marked (worker/src/features/digest.js). The card saves on every change
// (PUT /me/digest, no seats.aero call; the email's language is the site's language at that save), shows whether it
// will send (the verified email comes from the Email card above), the last email's top picks, and 寄一封給我看看
// (POST /me/digest/test, about 1 seats.aero call per airport).
(function () {
  const HOME = ['TPE', 'TSA', 'SEA'];
  const HOME_NAME = { TPE: '桃園', TSA: '松山', SEA: '西雅圖' };
  const OTHERS_MAX = 3;
  // stored hour: [what the card says, the stamp's time, the stamp's place]
  const TIMES = { 0: ['台灣早上 8 點', '8:00', '台灣'], 14: ['西雅圖早上 7 點', '7:00', '西雅圖'] };
  const NOTE = {
    unavailable: '上次查不到資料（可能是今天的額度用完了），下次會再試。', empty: '上次沒有找到直飛價格，所以沒寄。',
    mail_failed: '寄信失敗，下次再試', partial: '上一封有些機場查不到資料。',
  };
  const FRESH_MS = 5 * 60 * 1000;   // a revisit within 5 minutes draws from memory with no request
  // data: the last GET /me/digest; draft: settings changed on screen and not saved yet; A: 我的提醒's state (mail);
  // focus: where the next draw() puts the focus (a selector), when the control that had it goes away
  const ST = { data: null, at: 0, loading: null, err: null, draft: null, dirty: false, saving: false, rev: 0, msg: null, test: null, testing: false, code: '', pop: false, A: null, focus: null };
  let flushing = null;
  // bumped by onAuth: load(), run() and test() note it before each request and drop an answer that comes back
  // after another account signed in
  let epoch = 0;

  const others = d => d.airports.filter(c => !HOME.includes(c));
  const cabName = k => (CABIN_BY[k] || { name: k }).name;
  const inAmerica = () => { try { return /^America\//.test(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch { return false; } };
  // before the first save: the airport and hour of where this phone is (Seattle or Taiwan), business, off
  const defaults = () => (inAmerica() ? { on: false, airports: ['SEA'], cabins: ['J'], hour: 14, lang: LANG } : { on: false, airports: ['TPE'], cabins: ['J'], hour: 0, lang: LANG });
  const cur = () => ST.draft || (ST.data && ST.data.digest) || defaults();
  // an error in the language on screen now (messages are kept as errors, not text, so a language switch redraws them)
  const errText = err => (err.kind === 'alerts_off' ? t(ALERT_ERR.alerts_off) : err.kind === 'network' ? t('連不上伺服器，請檢查網路。') : ERR[err.kind] ? t(ERR[err.kind]) : err.message);
  const testErr = err => (err.kind === 'rate' ? t('一小時最多試寄 3 次，請晚一點再試。') : err.kind === 'mail_failed' ? t('寄信失敗，等一下再試。')
    : err.kind === 'save' ? t('設定還沒存好，請再試一次。') : errText(err));

  /* ---------- drawing ---------- */
  // each airport and cabin with its top 3 (or that it had none), in a grid that keeps the numbers in columns
  function picksHtml(list) {
    const rows = (list || []).filter(x => x && Array.isArray(x.top));
    return rows.length ? '<ul class="digest-picks">' + rows.map(x => '<li><b>' + esc(x.from) + ' ' + esc(cabName(x.cab)) + '</b>' +
      (x.top.length ? x.top.map(p => '<span>' + esc(p.to) + ' ' + n(fmtMiles(p.miles)) + '</span>').join('') : '<i>' + t('沒有直飛價格') + '</i>') + '</li>').join('') + '</ul>' : '';
  }
  // The envelope: will it send, to whom and when (the stamp), what the last one held; under it the language line and
  // the save message. status() redraws the text parts only, so the stamp's animation is not cut short by a save.
  function envText() {
    const d = cur(), sv = ST.data.digest, mail = ST.A && ST.A.mail, time = t(TIMES[d.hour][0]);
    let st, cls = '';
    if (!d.on) st = t('現在關著。打開之後，每天{0}寄一封。', time);
    else if (mail && mail.state !== 'verified') { st = t('Email 驗證好之後才會開始寄，請先完成上面的「Email 通知」。'); cls = ' bad'; }
    else { st = t('每天{0}寄到 {1}', time, esc(mail ? mail.email : ME ? ME.email : '')); cls = ' ok'; }
    const sent = !sv || !sv.sent_count ? t('還沒寄過信') : sv.sent_count === 1 ? t('已寄 1 封，最近一次 {0}', whenShort(sv.last_sent_at))
      : t('已寄 {0} 封，最近一次 {1}', sv.sent_count, whenShort(sv.last_sent_at));
    const note = sv && NOTE[sv.last_note] ? '<p class="digest-sub bad">' + t(NOTE[sv.last_note]) + '</p>' : '';
    return '<p class="digest-st' + cls + '">' + st + '</p><p class="digest-sub">' + sent + '</p>' + note;
  }
  function envLast() {
    const sv = ST.data.digest, last = sv && sv.last_sent_at && picksHtml(ST.data.last);
    return last ? '<p class="digest-ph">' + t('上一封（{0}）的前 3 名：', whenShort(sv.last_sent_at)) + '</p>' + last : '';
  }
  // a box's new contents, only when they changed; if the focus was inside, it goes to the box's new button, or to
  // the save message when the button is gone (a keyboard or VoiceOver user stays where they were, not at the top)
  function setBox(box, html) {
    if (box._h === html) return;
    const had = box.contains(document.activeElement);
    box._h = html;
    box.innerHTML = html;
    if (had) (box.querySelector('button') || document.getElementById('digest-msg')).focus({ preventScroll: true });
  }
  // The tail, under the envelope: the language line, the save message and 再試一次. #digest-msg is one element for
  // the card's life (draw() never rebuilds it) and only its words change: a screen reader reads a live region's
  // changes, but not a region that arrives already holding its text.
  function tail() {
    const card = document.getElementById('digest-card'), el = card && card.querySelector('#digest-msg');
    if (!el) return;
    const sv = ST.data.digest, m = ST.msg;
    setBox(card.querySelector('.digest-langbox'), sv && sv.lang !== LANG ? '<p class="digest-lang"><span>' + (LANG === 'en' ? t('信現在是中文的。') : t('信現在是英文的。')) + '</span>' +
      '<button type="button" class="btn ghost" data-dg-lang>' + (LANG === 'en' ? t('改成英文') : t('改成中文')) + '</button></p>' : '');
    // m: { k: Chinese text, err: the failed save's error }, translated here so it follows a language switch
    const words = m ? (m.err ? t(m.k, errText(m.err)) : t(m.k)) : '';
    el.className = 'msg' + (m ? (m.err ? ' bad' : ' ok') : '');
    if (el.textContent !== words) el.textContent = words;
    setBox(card.querySelector('.digest-retrybox'), m && m.err ? '<button type="button" class="btn ghost digest-retry" data-dg-retry>' + t('再試一次') + '</button>' : '');
  }
  function liveHtml() {
    const d = cur();
    const stamp = '<div class="digest-stamp' + (ST.pop ? ' pop' : '') + '" aria-hidden="true"><b>' + TIMES[d.hour][1] + '</b><small>' + t(TIMES[d.hour][2]) + '</small></div>';
    ST.pop = false;
    return '<div class="digest-env' + (d.on ? '' : ' off') + '"><div class="digest-row"><div class="digest-envt">' + envText() + '</div>' + stamp + '</div>' +
      '<div class="digest-last">' + envLast() + '</div></div>';
  }
  function testHtml() {
    const r = ST.test;
    if (ST.testing) return '<p>' + t('寄送中…') + '</p>';
    if (!r) return '';
    if (r.err) return '<p class="bad">' + esc(testErr(r.err)) + '</p>';
    const failed = r.failed && r.failed.length ? '<p class="bad">' + t('這次查不到 {0} 的資料。', esc(r.failed.join(t('、')))) + '</p>' : '';
    if (r.mailed) return '<p class="ok">' + t('寄出了！收件匣找不到的話，看看垃圾郵件匣。') + '</p>' + failed;
    if (r.note === 'unverified') return '<p>' + t('Email 還沒驗證，所以沒寄。內容會是這樣：') + '</p>' + picksHtml(r.preview) + failed;
    if (r.note === 'empty') return '<p>' + t('seats.aero 的快取裡沒有這些機場的直飛價格。') + '</p>';
    return '<p class="bad">' + t('現在查不到資料（可能是今天的額度用完了）。') + '</p>';
  }
  const head = () => '<h3>' + t('📬 每日精選信') + '</h3>';
  function draw() {
    const card = document.getElementById('digest-card');
    if (!card) return;
    if (!ST.data) {
      card.innerHTML = head() + (ST.err ? '<p class="msg bad">' + esc(errText(ST.err)) + '</p><button type="button" class="btn ghost digest-retry" data-dg-reload>' + t('再試一次') + '</button>' : '<div class="skel"></div>');
      return;
    }
    if (!ST.data.allowed) { card.innerHTML = head() + '<p class="note0">' + t(ALERT_ERR.alerts_off) + '</p>'; return; }
    const input = document.getElementById('digest-code'), focused = !!input && document.activeElement === input;
    if (input) ST.code = input.value;
    // a keyboard user's place: the same control again after the redraw (the switch, a chip, the time)
    const act = document.activeElement, dg = act && act !== input && card.contains(act) && act.id ? '#' + act.id
      : act && card.contains(act) ? Object.keys(act.dataset).filter(k => k.startsWith('dg')).map(k => '[data-' + k.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + '="' + act.dataset[k] + '"]')[0] : null;
    const d = cur(), more = others(d);
    const chip = (attrs, inner) => '<button type="button" class="chip" ' + attrs + '>' + inner + '</button>';
    // the frame, made once per card: the top and the settings are redrawn on every change; the tail between them
    // keeps its save message (see tail())
    if (!card.querySelector('#digest-msg')) {
      card.innerHTML = '<div class="digest-top"></div><div class="digest-tail"><div class="digest-langbox"></div>' +
        '<p class="msg" id="digest-msg" role="status" tabindex="-1"></p><div class="digest-retrybox"></div></div><div class="digest-set"></div>';
    }
    card.querySelector('.digest-top').innerHTML = head() +
      '<p class="note0">' + t('每天一封信，列出從你的機場出發、直飛最便宜的商務艙或頭等艙目的地，每個機場前 10 名。') + '</p>' +
      '<label class="switch digest-sw"><input type="checkbox" id="digest-on"' + (d.on ? ' checked' : '') + '><span class="tr"></span><span>' + t('每天寄給我') + '</span></label>' +
      '<div class="digest-live">' + liveHtml() + '</div>';
    card.querySelector('.digest-set').innerHTML =
      '<div class="lbl" id="digest-l-ap">' + t('出發機場（最多 6 個）') + '</div>' +
      '<div class="digest-grid" role="group" aria-labelledby="digest-l-ap">' +
        HOME.map(c => chip('data-dg-ap="' + c + '" aria-pressed="' + d.airports.includes(c) + '"', '<b>' + c + '</b><small>' + t(HOME_NAME[c]) + '</small>')).join('') + '</div>' +
      (more.length ? '<div class="chips digest-more">' + more.map(c => chip('data-dg-rm="' + esc(c) + '" aria-label="' + t('移除 {0}', esc(c)) + '"',
        '<b>' + esc(c) + '</b>' + (AIRPORT_ZH[c] ? '<small>' + esc(AIRPORT_ZH[c]) + '</small>' : '') + '<span class="digest-x" aria-hidden="true">✕</span>')).join('') + '</div>' : '') +
      (more.length < OTHERS_MAX
        ? '<form class="digest-add" novalidate><div class="field"><label for="digest-code">' + t('其他機場（三碼代號）') + '</label>' +
          '<input id="digest-code" maxlength="3" value="' + esc(ST.code) + '" placeholder="' + t('例：NRT') + '" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="done"></div>' +
          '<button class="btn" type="submit">' + t('加入') + '</button></form>'
        : '<p class="note0 digest-full">' + t('其他機場最多 3 個。') + '</p>') +
      '<p class="msg bad" id="digest-code-msg" role="alert"></p>' +
      '<div class="lbl" id="digest-l-cab">' + t('艙等（至少一個）') + '</div>' +
      '<div class="digest-grid two" role="group" aria-labelledby="digest-l-cab">' +
        ['J', 'F'].map(k => chip('data-dg-cab="' + k + '" aria-pressed="' + d.cabins.includes(k) + '"', esc(cabName(k)))).join('') + '</div>' +
      '<p class="msg bad" id="digest-cab-msg" role="alert"></p>' +
      '<div class="lbl" id="digest-l-time">' + t('寄信時間') + '</div>' +
      '<div class="seg two digest-time" role="radiogroup" aria-labelledby="digest-l-time">' +
        [0, 14].map(h => '<button type="button" role="radio" data-dg-hour="' + h + '" aria-checked="' + (d.hour === h) + '">' + t(TIMES[h][0]) + '</button>').join('') + '</div>' +
      '<p class="note0 digest-cost">' + t('每天每個機場大約用 1 次額度（現在一天約 {0} 次）。只會寄到驗證過的 Email。', d.airports.length) + '</p>' +
      '<div class="digest-acts"><button type="button" class="btn ghost" data-dg-test' + (ST.testing ? ' disabled' : '') + '>' + (ST.testing ? t('寄送中…') : t('寄一封給我看看')) + '</button>' +
        '<small>' + t('大約用 {0} 次額度', d.airports.length) + '</small></div>' +
      '<div class="digest-out" id="digest-out" aria-live="polite">' + testHtml() + '</div>';
    tail();
    // the focus: where an action asked for it (the chip that took a removed one's place, a chip just added), else
    // back in the code box, else the same control as before the redraw
    const want = ST.focus && card.querySelector(ST.focus);
    ST.focus = null;
    if (want) want.focus({ preventScroll: true });
    else if (focused) { const x = document.getElementById('digest-code'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }
    else if (dg) { const x = card.querySelector(dg); if (x) x.focus({ preventScroll: true }); }
  }
  // only the envelope's words, the last picks and the tail (the stamp and the code box stay)
  function status() {
    const card = document.getElementById('digest-card');
    if (!card || !ST.data || !ST.data.allowed || !card.querySelector('#digest-msg')) return;
    card.querySelector('.digest-envt').innerHTML = envText();
    card.querySelector('.digest-last').innerHTML = envLast();
    tail();
  }
  function drawTest() {
    const out = document.getElementById('digest-out'), b = document.querySelector('#digest-card [data-dg-test]');
    if (out) out.innerHTML = testHtml();
    if (b) { b.disabled = ST.testing; b.textContent = ST.testing ? t('寄送中…') : t('寄一封給我看看'); }
  }

  /* ---------- loading and saving ---------- */
  function load() {
    if (ST.loading) return;
    const rev = ST.rev, my = epoch;
    if (!ST.data) { ST.err = null; draw(); }
    ST.loading = call('GET', '/me/digest')
      .then(r => {
        if (my !== epoch) return;   // meant for the account signed in before
        // a save that finished meanwhile is newer than this answer
        if (rev === ST.rev && !ST.saving) ST.data = r; else if (ST.data) ST.data.allowed = r.allowed;
        ST.at = Date.now(); ST.err = null;
      })
      .catch(err => { if (my === epoch) ST.err = err; })
      .finally(() => { if (my === epoch) { ST.loading = null; draw(); } });
  }
  // one save at a time; changes made while one is out go in the next, so the last change always wins
  function save() {
    ST.dirty = true;
    if (!flushing) { const f = run().finally(() => { if (flushing === f) flushing = null; }); flushing = f; }
    return flushing;
  }
  async function run() {
    const my = epoch;
    while (ST.dirty) {
      ST.dirty = false; ST.saving = true; ST.msg = { k: '儲存中…' };
      status();
      const d = cur();
      try {
        const r = await call('PUT', '/me/digest', { on: d.on, airports: d.airports, cabins: d.cabins, hour: d.hour, lang: LANG });
        if (my !== epoch) return;   // another account signed in meanwhile: onAuth has reset everything
        ST.rev++;
        ST.data.digest = r.digest; ST.data.last = r.last || []; ST.at = Date.now();
        if (!ST.dirty) ST.draft = null;
        ST.msg = { k: '已儲存' };
      } catch (err) {
        if (my !== epoch) return;
        ST.msg = { k: '沒有存到：{0}', err };
        if (err.kind === 'alerts_off') ST.data.allowed = false;
      }
    }
    ST.saving = false;
    if (ST.data.allowed) status(); else draw();
  }
  function change(fn) {
    const d = JSON.parse(JSON.stringify(cur()));
    if (fn(d) === false) { ST.focus = null; return; }
    d.lang = LANG;
    ST.draft = d;
    ST.test = null;   // a preview of the old settings would mislead
    draw();
    save();
  }

  /* ---------- actions ---------- */
  function toggleAirport(code) {
    change(d => {
      if (d.airports.includes(code)) {
        if (d.airports.length === 1) { setMsg('digest-code-msg', t('至少要留一個機場。')); return false; }
        d.airports = d.airports.filter(c => c !== code);
      } else d.airports = HOME.filter(c => c === code || d.airports.includes(c)).concat(others(d));   // the three keep their order
    });
  }
  function removeAirport(code) {
    change(d => {
      if (d.airports.length === 1) { setMsg('digest-code-msg', t('至少要留一個機場。')); return false; }
      // the focus goes to the chip that takes this one's place, else the one before it, else 加入 (not the code
      // box, which would bring up the phone's keyboard)
      const list = others(d), rest = list.filter(c => c !== code);
      ST.focus = rest.length ? '[data-dg-rm="' + rest[Math.min(list.indexOf(code), rest.length - 1)] + '"]' : '.digest-add .btn';
      d.airports = d.airports.filter(c => c !== code);
    });
  }
  function addAirport() {
    const input = document.getElementById('digest-code'), v = input ? input.value.trim().toUpperCase() : '', d = cur();
    if (!/^[A-Z]{3}$/.test(v)) { setMsg('digest-code-msg', t('請輸入三碼機場代號，例如 NRT。')); return; }
    if (d.airports.includes(v)) { setMsg('digest-code-msg', t('{0} 已經在清單裡了。', v)); return; }
    if (!HOME.includes(v) && others(d).length >= OTHERS_MAX) { setMsg('digest-code-msg', t('其他機場最多 3 個。')); return; }
    ST.code = '';
    if (input) { input.value = ''; input.blur(); }   // the keyboard goes away once the code is in
    // and the focus lands on the chip just added, so a keyboard or VoiceOver user hears what went in
    ST.focus = HOME.includes(v) ? '[data-dg-ap="' + v + '"]' : '[data-dg-rm="' + v + '"]';
    if (HOME.includes(v)) toggleAirport(v); else change(x => { x.airports.push(v); });
  }
  function toggleCabin(k) {
    change(d => {
      const has = d.cabins.includes(k);
      if (has && d.cabins.length === 1) { setMsg('digest-cab-msg', t('至少要選一個艙等。')); return false; }
      d.cabins = ['J', 'F'].filter(x => (x === k ? !has : d.cabins.includes(x)));
    });
  }
  async function test() {
    if (ST.testing) return;
    const my = epoch;
    ST.testing = true; ST.test = null;
    drawTest();
    try {
      if (flushing) await flushing;
      if (my !== epoch) return;   // another account signed in meanwhile
      if (!ST.data.digest || ST.draft) { ST.draft = cur(); await save(); }   // the Worker builds it from the saved settings
      if (my !== epoch) return;
      if (!ST.data.digest || ST.draft) throw new ApiError('save', t('設定還沒存好，請再試一次。'));
      const r = await call('POST', '/me/digest/test');
      if (my !== epoch) return;
      if (r.digest) ST.data.digest = r.digest;
      if (r.last) ST.data.last = r.last;
      ST.test = r;
      if (typeof loadQuota === 'function') loadQuota();   // it spent calls: the 已用 meter
    } catch (err) {
      if (my !== epoch) return;
      ST.test = { err };
    }
    ST.testing = false;
    status();
    drawTest();
  }
  function wire(card) {
    card.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !card.contains(b) || b.disabled) return;
      const ds = b.dataset;
      if (ds.dgAp) toggleAirport(ds.dgAp);
      else if (ds.dgRm) removeAirport(ds.dgRm);
      else if (ds.dgCab) toggleCabin(ds.dgCab);
      else if (ds.dgHour) { const h = +ds.dgHour; change(d => { if (d.hour === h) return false; d.hour = h; ST.pop = true; }); }
      else if ('dgLang' in ds) change(() => {});   // saves with the language on screen
      else if ('dgTest' in ds) test();
      else if ('dgRetry' in ds) { ST.msg = null; save(); }
      else if ('dgReload' in ds) load();
    });
    card.addEventListener('change', e => { if (e.target.id === 'digest-on') { const on = e.target.checked; change(d => { d.on = on; }); } });
    card.addEventListener('submit', e => { e.preventDefault(); addAirport(); });
    card.addEventListener('input', e => {
      if (e.target.id !== 'digest-code') return;
      const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
      if (v !== e.target.value) e.target.value = v;
      ST.code = v;
      setMsg('digest-code-msg', '');
    });
  }

  addFeature({
    id: 'digest',
    css: `
.digest h3{margin-bottom:4px}
.digest .note0{margin:0 0 6px}
.digest-sw{min-height:44px;margin:0 0 4px;font-size:16px}
.digest-env{border:2px dashed var(--ink);border-radius:16px;background:var(--yellow-t);padding:9px 10px 10px;margin:0 0 6px}
.digest-row{display:flex;align-items:flex-start;gap:10px}
.digest-envt{flex:1;min-width:0}
.digest-envt p{margin:0;overflow-wrap:anywhere}
.digest-st{font-size:15px;line-height:1.45}
.digest-st.ok{color:#2F6B2F}
.digest-st.bad,.digest-sub.bad{color:#A33A2A}
.digest-envt .digest-sub{font-size:12px;line-height:1.45;color:var(--ink2);margin-top:3px}
.digest-envt .digest-sub.bad{color:#A33A2A}
.digest-stamp{flex:0 0 58px;margin:2px 3px 0 0;padding:7px 2px 6px;text-align:center;line-height:1.1;border:var(--line);border-radius:8px;background:var(--coral-t);outline:2px dashed var(--ink);outline-offset:-7px;transform:rotate(4deg)}
.digest-stamp b{display:block;font-size:19px;font-weight:400;font-variant-numeric:tabular-nums}
.digest-stamp small{display:block;font-size:11px;margin-top:2px;white-space:nowrap}
.digest-env.off .digest-stamp{opacity:.45;filter:grayscale(1)}
.digest-stamp.pop{animation:digest-stamp .45s var(--pop)}
@keyframes digest-stamp{from{transform:rotate(-12deg) scale(1.35);opacity:.2}to{transform:rotate(4deg) scale(1);opacity:1}}
.digest-env.off .digest-stamp.pop{animation:none}
.digest-ph{font-size:12px;color:var(--ink2);margin:8px 0 2px;padding-top:7px;border-top:2px dashed var(--ink)}
.digest-picks{list-style:none;margin:0;padding:0;font-size:13px;line-height:1.5}
.digest-picks li{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:0 8px;padding:2px 0}
.digest-picks b,.digest-picks i{grid-column:1/-1;font-weight:400;font-style:normal}
.digest-picks b{font-size:12px;color:var(--ink2)}
.digest-picks span{white-space:nowrap;letter-spacing:.3px}
.digest-lang{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font-size:14px;margin:0 0 6px}
.digest .digest-lang .btn,.digest .digest-retry{min-height:40px;font-size:14px;padding:2px 14px}
.digest .digest-retry{margin:4px 0 2px}
.digest-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.digest-grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.digest .chip{min-height:44px;justify-content:center;text-align:center;line-height:1.2}
.digest-grid .chip{flex-direction:column;gap:1px;min-width:0;padding:3px 4px;border-radius:16px}
.digest-grid .chip b{font-weight:400;font-size:16px;letter-spacing:.5px}
.digest-grid .chip small{max-width:100%;font-size:11px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.digest-more{margin-top:6px}
.digest-more .chip{background:var(--yellow);padding:2px 10px 2px 12px;gap:6px}
.digest-more .chip b{font-weight:400;letter-spacing:.5px}
.digest-more .chip small{font-size:12px;color:var(--ink2)}
.digest-x{font-size:13px}
.digest .digest-add{display:flex;align-items:flex-end;gap:8px;margin-top:8px}
.digest-add .field{flex:1;min-width:0}
.digest-add input{text-transform:uppercase;letter-spacing:1px}
.digest-add input::placeholder{text-transform:none;letter-spacing:0;color:#A39C98}
.digest-add .btn{flex:0 0 auto;min-height:44px;padding:3px 18px}
.digest .digest-full{margin:8px 0 0}
.digest #digest-code-msg,.digest #digest-cab-msg{margin-top:4px}
.digest .seg button{min-height:44px}
.digest .digest-cost{margin:10px 0 0}
.digest-acts{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-top:10px}
.digest-acts .btn{min-height:44px}
.digest-acts .btn[disabled]{opacity:.6}
.digest-acts small{font-size:12px;color:var(--ink2)}
.digest-out{border:2px dashed var(--ink);border-radius:14px;background:var(--paper);padding:7px 10px;margin-top:8px;font-size:14px}
.digest-out:empty{display:none}
.digest-out p{margin:0}
.digest-out p+p,.digest-out p+ul{margin-top:4px}
.digest-out .ok{color:#2F6B2F}
.digest-out .bad{color:#A33A2A}
.digest #digest-msg{margin:2px 0 0}
/* the live regions stay in the page while empty (.msg:empty is display:none), so the words they get are read */
.digest #digest-msg:empty,.digest #digest-code-msg:empty,.digest #digest-cab-msg:empty{display:block;margin:0}
.digest #digest-msg:focus{outline:0}
.digest #digest-msg:focus-visible{outline:3px solid var(--water);outline-offset:2px;border-radius:4px}
`,
    en: {
      '📬 每日精選信': '📬 Daily digest',
      '每天一封信，列出從你的機場出發、直飛最便宜的商務艙或頭等艙目的地，每個機場前 10 名。': 'One email a day with the cheapest nonstop business or first class destinations from your airports, the top 10 for each.',
      '每天寄給我': 'Email me every day',
      '出發機場（最多 6 個）': 'Home airports (up to 6)',
      '桃園': 'Taoyuan',
      '松山': 'Songshan',
      '西雅圖': 'Seattle',
      '移除 {0}': 'Remove {0}',
      '其他機場（三碼代號）': 'Other airport (code)',
      '例：NRT': 'e.g. NRT',
      '加入': 'Add',
      '其他機場最多 3 個。': 'Up to 3 other airports.',
      '請輸入三碼機場代號，例如 NRT。': 'Enter a 3-letter airport code, such as NRT.',
      '{0} 已經在清單裡了。': '{0} is already on the list.',
      '至少要留一個機場。': 'Keep at least one airport.',
      '至少要選一個艙等。': 'Pick at least one cabin.',
      '艙等（至少一個）': 'Cabins (at least one)',
      '寄信時間': 'Send time',
      '台灣早上 8 點': '8 am in Taiwan',
      '西雅圖早上 7 點': '7 am in Seattle',
      '現在關著。打開之後，每天{0}寄一封。': 'Off now. Turn it on to get one every day at {0}.',
      'Email 驗證好之後才會開始寄，請先完成上面的「Email 通知」。': 'Starts once your email is verified: finish Email alerts above first.',
      '每天{0}寄到 {1}': 'Sent every day at {0} to {1}',
      '上次查不到資料（可能是今天的額度用完了），下次會再試。': 'No data came back last time (maybe the quota ran out). It will try again.',
      '上次沒有找到直飛價格，所以沒寄。': 'No nonstop prices were found last time, so nothing was sent.',
      '上一封有些機場查不到資料。': 'Some airports had no data in the last email.',
      '已寄 1 封，最近一次 {0}': '1 email sent, last {0}',
      '上一封（{0}）的前 3 名：': 'Top 3 in the last email ({0}):',
      '信現在是中文的。': 'Emails are in Chinese now.',
      '信現在是英文的。': 'Emails are in English now.',
      '改成中文': 'Switch to Chinese',
      '改成英文': 'Switch to English',
      '每天每個機場大約用 1 次額度（現在一天約 {0} 次）。只會寄到驗證過的 Email。': 'Uses about 1 call a day per airport ({0} a day now). Sent only to a verified email.',
      '寄一封給我看看': 'Send me one now',
      '大約用 {0} 次額度': "Uses about {0} of today's calls",
      '寄送中…': 'Sending…',
      '寄出了！收件匣找不到的話，看看垃圾郵件匣。': "Sent! If it isn't in your inbox, check spam.",
      'Email 還沒驗證，所以沒寄。內容會是這樣：': "Not sent: your email isn't verified yet. It would list:",
      'seats.aero 的快取裡沒有這些機場的直飛價格。': "seats.aero's cache has no nonstop prices from these airports.",
      '現在查不到資料（可能是今天的額度用完了）。': "No data right now (maybe today's quota ran out).",
      '這次查不到 {0} 的資料。': 'No data for {0} this time.',
      '沒有直飛價格': 'No nonstop prices',
      '一小時最多試寄 3 次，請晚一點再試。': 'Up to 3 test emails an hour. Try again later.',
      '寄信失敗，等一下再試。': 'The email failed. Try again in a moment.',
      '設定還沒存好，請再試一次。': "Settings aren't saved yet. Try again.",
      '儲存中…': 'Saving…',
      '已儲存': 'Saved',
      '沒有存到：{0}': 'Not saved: {0}',
    },
    onAlertsPage(el, A) {
      ST.A = A;
      el.insertAdjacentHTML('beforeend', '<div class="acard digest" id="digest-card"></div>');
      wire(el.lastElementChild);
      if (ST.data) draw();
      if (!ST.data || Date.now() - ST.at > FRESH_MS) load();
    },
    onLang() { draw(); },
    // another account may have signed in: start over, and drop the answers still out for the one before
    onAuth() {
      epoch++;
      flushing = null;
      Object.assign(ST, { data: null, at: 0, loading: null, err: null, draft: null, dirty: false, saving: false, msg: null, test: null, testing: false, code: '', focus: null });
    },
  });
})();
