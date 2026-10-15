// 點數錢包 (points wallet), 2026-10-15: the account's own balances of Gino's five bank and hotel currencies (BANKS)
// and of the airline programs (PROGRAMS). Every result card then says whether those points already cover the
// award, which one bank transfer would (pointsFor: Marriott's 3,000 steps and bonuses, Amex's 250 / 500 steps), or
// how far short they are; a card's details list each bank route; 更多篩選 gets a 只看我付得起的 switch.
// The program's own miles count first (for the four Avios programs, Avios held in the linked ones too), and a
// transfer only tops up the rest. With 人數 above 1 everything is for that many seats.
// Balances live in D1 (GET / PUT /me/wallet; a PUT carries only the changed keys, 0 removes one, 800 ms after the
// last keystroke) and in localStorage, so cards can use them before the reply. The local copy names the account it
// belongs to: another account signing in on this device starts from its own copy on the server.
// Other features can read it through window.WALLET (see the bottom of this file).
(() => {
  const LS = 'award-wallet', MAX = 100000000, SAVE_MS = 800;
  // each bank's card in the wallet: its color and what its points are called
  const LOOK = {
    amex: ['water', 'Membership Rewards'], chase: ['green', 'Ultimate Rewards'], citi: ['yellow', 'ThankYou'],
    capitalone: ['coral', 'Capital One Miles'], marriott: ['water', 'Bonvoy'],
  };
  const keyOK = k => BANKS.some(b => b[0] === k) || Object.prototype.hasOwnProperty.call(PROGRAMS, k);
  const clean = o => {
    const out = {};
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      for (const [k, v] of Object.entries(o)) if (keyOK(k) && Number.isInteger(v) && v > 0 && v <= MAX) out[k] = v;
    }
    return out;
  };
  const kept = load(LS, null) || {};
  let owner = typeof kept.email === 'string' ? kept.email : '';   // the account these balances belong to
  let bal = clean(kept.b);
  const dirty = new Set((Array.isArray(kept.dirty) ? kept.dirty : []).filter(keyOK));   // changed, not saved yet
  let at = Number.isFinite(kept.at) ? kept.at : null;                                     // updated_at on the server
  let loaded = false, busy = false, again = false, timer = 0, progsOpen = false;   // loaded: read from the Worker this session
  let status = ['idle'];
  const persist = () => save(LS, { email: owner, b: bal, dirty: [...dirty], at });
  const hasAny = () => Object.keys(bal).length > 0;
  // "用 萬豪 轉" reads "用萬豪轉": no space between two Chinese words once a bank name is filled in
  const tidy = s => (LANG === 'en' ? s : s.replace(/([\u3400-\u9fff]) (?=[\u3400-\u9fff])/g, '$1'));
  const people = () => Math.min(9, Math.max(1, S.prefs.pax || 1));

  /* ---------- what the wallet says about one award ---------- */
  // Avios move 1:1 and free between British Airways, Iberia and Finnair, and between Qatar and British Airways only
  // (the page's own note under 用點數換; its TRANSFERS also send points on through two of these moves). So Avios held
  // in one of the four count for the others, the programs one move away first; Qatar to Iberia or Finnair goes
  // through British Airways.
  const AVIOS = ['british', 'iberia', 'finnair', 'qatar'];
  const hops = (a, b) => ((a === 'qatar' || b === 'qatar') && a !== 'british' && b !== 'british' ? 2 : 1);
  const aviosFor = src => (AVIOS.includes(src) ? AVIOS.filter(k => k !== src).sort((a, b) => hops(src, a) - hops(src, b)) : []);
  // v.ok: the points cover it; v.kind: own (the program's own miles), avios (with Avios moved over from the linked
  // programs), bank / topup (one transfer, topup = on top of the miles already there), shortBank / shortOwn /
  // shortAvios (the smallest gap), none (routes exist, no points on them), '' (nothing to say: no route and no
  // miles). v.have: the program's own miles; v.moves: Avios taken from each linked program; v.pool: both together
  // (never more than the need); v.banks: every bank route with what it needs on top of the pool.
  // Cached per program, miles per person and 人數 (the verdict prints the person count); cleared on every change.
  const memo = new Map();
  function judge(src, miles) {
    const n = people(), need = miles * n, key = src + '|' + miles + '|' + n;
    if (memo.has(key)) return memo.get(key);
    const have = bal[src] || 0, moves = [];
    let pool = Math.min(have, need);
    for (const k of aviosFor(src)) {
      if (pool >= need) break;
      if (!bal[k]) continue;
      const take = Math.min(bal[k], need - pool);
      moves.push({ k, own: bal[k], take });
      pool += take;
    }
    const routes = routesTo(src), rest = need - pool;
    const banks = BANKS.filter(([k]) => routes[k]).map(([k]) => {
      const pts = rest ? pointsFor(rest, k, src, routes[k]) : 0, own = bal[k] || 0;
      return { k, own, pts, ok: !!rest && pts != null && own > 0 && own >= pts, gap: pts == null ? Infinity : Math.max(0, pts - own) };
    });
    let v;
    if (have >= need) v = { ok: true, kind: 'own' };
    else if (pool >= need) v = { ok: true, kind: 'avios' };
    else {
      const fit = banks.filter(b => b.ok).sort((a, b) => a.pts - b.pts)[0];   // the fewest points
      if (fit) v = { ok: true, kind: pool ? 'topup' : 'bank', b: fit };
      else {
        const gaps = [];
        if (pool) gaps.push({ kind: moves.length ? 'shortAvios' : 'shortOwn', gap: need - pool });
        for (const b of banks) if (b.own && isFinite(b.gap)) gaps.push({ kind: 'shortBank', gap: b.gap, b });
        gaps.sort((x, y) => x.gap - y.gap);
        v = gaps[0] ? Object.assign({ ok: false }, gaps[0]) : { ok: false, kind: banks.length ? 'none' : '' };
      }
    }
    Object.assign(v, { have, moves, pool, need, n, banks });
    memo.set(key, v);
    return v;
  }
  const moved = v => v.moves.reduce((s, m) => s + m.take, 0);
  // the one line on a card
  function lineText(src, v) {
    const name = prog(src).name, bank = v.b ? BANK_NAME[v.b.k] : '';
    const s = v.kind === 'own' ? t('你的 {0} 夠', name)
      : v.kind === 'avios' ? t('從 {0} 移 {1} Avios 過去就夠', v.moves.map(m => prog(m.k).name).join(t('、')), fmtMiles(moved(v)))
      : v.kind === 'bank' ? t('用 {0} 轉 {1} 點就夠', bank, fmtMiles(v.b.pts))
      : v.kind === 'topup' ? t('再用 {0} 轉 {1} 點就夠', bank, fmtMiles(v.b.pts))
      : v.kind === 'shortBank' ? t('{0} 還差 {1} 點', bank, fmtMiles(v.gap))
      : v.kind === 'shortOwn' ? t('你的 {0} 還差 {1} 哩', name, fmtMiles(v.gap))
      : v.kind === 'shortAvios' ? t('你的 Avios 還差 {0} 哩', fmtMiles(v.gap))
      : v.kind === 'none' ? t('你的點數轉不過去') : '';
    return s ? '💳 ' + tidy(s) + (v.n > 1 && v.kind !== 'none' ? t('（{0} 人）', v.n) : '') : '';
  }
  // the 你的點數 block in a card's details: the program's own miles, the Avios that can move over, then each bank route
  function detailsHtml(src, miles) {
    const v = judge(src, miles), p = prog(src);
    if (!v.banks.length && !v.have && !v.moves.length) return '';
    const li = (name, own, verdict, ok) => '<li' + (ok ? ' class="ok"' : '') + '><span class="wallet-db">' + esc(name) + '</span><span class="wallet-dn">' + own + '</span><span class="wallet-dv">' + verdict + '</span></li>';
    let rows = '';
    if (v.have) rows += li(p.name, t('{0} 哩', fmtMiles(v.have)), v.have >= v.need ? t('✓ 夠') : t('還差 {0} 哩', fmtMiles(v.need - v.have)), v.have >= v.need);
    if (v.have < v.need) {
      v.moves.forEach((m, i) => {
        const last = i === v.moves.length - 1 && v.pool >= v.need;
        rows += li(prog(m.k).name, t('{0} 哩', fmtMiles(m.own)), last ? t('✓ 移 {0} 過去就夠', fmtMiles(m.take)) : t('可移 {0} 過去', fmtMiles(m.take)), last);
      });
    }
    if (v.pool < v.need) {
      for (const b of v.banks) rows += li(BANK_NAME[b.k], b.own ? t('{0} 點', fmtMiles(b.own)) : t('還沒填'),
        b.ok ? t('✓ 轉 {0} 點就夠', fmtMiles(b.pts)) : b.pts == null ? '' : t('還差 {0} 點', fmtMiles(b.gap)), b.ok);
    }
    const head = v.n > 1 ? t('你的點數（{0} 人共 {1} 哩）', v.n, fmtMiles(v.need)) : t('你的點數（{0} 哩）', fmtMiles(v.need));
    const note = !v.pool || v.pool >= v.need || !v.banks.length ? ''
      : '<p class="note0">' + (v.moves.length ? t('要轉的點數已經扣掉你在這幾個計畫的 {0} Avios。', fmtMiles(v.pool)) : t('要轉的點數已經扣掉你的 {0} {1} 哩。', esc(p.name), fmtMiles(v.have))) + '</p>';
    return '<div class="wallet-dh"><b>💳 ' + head + '</b><a href="#/wallet">' + t('改點數') + '</a></div><ul>' + rows + '</ul>' + note;
  }

  /* ---------- the cards, their details and the filter switch ---------- */
  function decorate() {
    const any = hasAny();
    for (const art of $$('#list .offer')) {
      const head = art.querySelector('.ohead');
      if (!head) continue;
      let ln = head.querySelector('.wallet-ln');
      const v = any ? judge(art.dataset.src, +art.dataset.miles) : null, text = v ? lineText(art.dataset.src, v) : '';
      if (!text) { if (ln) ln.remove(); } else {
        if (!ln) { ln = document.createElement('span'); head.appendChild(ln); }
        ln.className = 'wallet-ln' + (v.ok ? ' ok' : '');
        ln.innerHTML = '<span>' + esc(text) + '</span>';
      }
      fillDetails(art);
    }
  }
  function fillDetails(art) {
    const box = art.querySelector('.trips .wallet-d');
    if (box) box.innerHTML = hasAny() ? detailsHtml(art.dataset.src, +art.dataset.miles) : '';
  }
  function drawSwitch(box) {
    const any = hasAny(), on = any && !!S.prefs.walletOnly;
    const hint = any ? t('用點數錢包的餘額算：直接夠，或轉一次點就夠。') : t('點數錢包還是空的。') + ' <a href="#/wallet">' + t('先去填點數') + '</a>';
    const cb = box.querySelector('#wallet-only');
    // keep the switch (and its focus) when only its state changes. The language it was drawn in is kept as data-wl,
    // never data-lang: the page takes a tap on any [data-lang] for its language buttons.
    if (cb && box.dataset.wl === LANG) {
      cb.checked = on; cb.disabled = !any;
      box.querySelector('.wallet-fh').innerHTML = hint;
      return;
    }
    box.dataset.wl = LANG;
    box.innerHTML = '<label class="switch"><input type="checkbox" id="wallet-only"' + (on ? ' checked' : '') + (any ? '' : ' disabled') + '><span class="tr"></span><span>' + t('只看我付得起的') + '</span></label>' +
      '<p class="wallet-fh">' + hint + '</p>';
  }
  // while the switch hides awards, a chip in the sort bar says so (like 只看 11/1 ✕) and turns it off. Not a .chip,
  // because the sort bar's own handler takes every .chip for a sort option. The button is the 42px tap area and the
  // span inside draws the pill (WebKit does not hit-test a button's ::after outside the button).
  function drawIndicator() {
    const bar = $('#sortbar');
    if (!bar) return;
    let b = bar.querySelector('.wallet-on');
    if (!(S.prefs.walletOnly && hasAny())) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('button');
      b.type = 'button'; b.className = 'wallet-on'; b.dataset.walletOff = '1';
      b.appendChild(document.createElement('span'));
      bar.insertBefore(b, bar.querySelector('.dseg'));
    }
    b.firstChild.textContent = '💳 ' + t('只看付得起的') + '　✕';
    b.setAttribute('aria-label', t('關掉「只看付得起的」'));   // holds the visible words, so voice control finds it
  }
  // The page's filter summary counts this switch through active() below; while it is on, 清除航班條件 stays visible
  // (it turns the switch off too, below), and an empty list says the switch may be why.
  function markFilters() {
    const on = !!S.prefs.walletOnly && hasAny();
    const clr = $('#tf-clear');
    if (clr && on) clr.hidden = false;
    const empty = $('#list .empty');
    const hint = empty && empty.querySelector('.wallet-e');
    if (!empty || !on) { if (hint) hint.remove(); return; }
    const html = '<span>' + t('「只看我付得起的」開著，點數不夠的位子都先藏起來了。') + '</span><button type="button" class="btn ghost" data-wallet-off="1">' + t('關掉這個篩選') + '</button>';
    if (hint) hint.innerHTML = html;
    else empty.insertAdjacentHTML('beforeend', '<p class="wallet-e">' + html + '</p>');
  }
  const setOnly = on => { S.prefs.walletOnly = on; savePrefs(); render(); };
  document.addEventListener('change', e => { if (e.target.id === 'wallet-only') setOnly(e.target.checked); });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-wallet-off]')) setOnly(false); });
  // 清除航班條件 turns the switch off too (capture: before the page's own handler saves and redraws)
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#tf-clear')) S.prefs.walletOnly = false; }, true);

  /* ---------- saving: PUT the changed keys, or GET when nothing changed ---------- */
  function adopt(r) {
    const next = clean(r && r.balances);
    for (const k of dirty) { if (bal[k]) next[k] = bal[k]; else delete next[k]; }   // edits made meanwhile win
    const same = JSON.stringify(Object.entries(next).sort()) === JSON.stringify(Object.entries(bal).sort());
    bal = next;
    at = r && Number.isFinite(r.updated_at) ? r.updated_at : null;
    persist();
    if (!same) changed();
  }
  async function sync() {
    if (busy) { again = true; return; }
    if (!ME || !getToken()) return;   // ME unknown (offline start): never send a copy that may be another account's
    claim();
    busy = true;
    const sent = {};
    for (const k of dirty) sent[k] = bal[k] || 0;
    const keys = Object.keys(sent), put = keys.length > 0, refused = [];
    setStatus(put ? 'saving' : 'loading');
    try {
      let r = null;
      if (!put) r = await call('GET', '/me/wallet');
      else {
        try { r = await call('PUT', '/me/wallet', { balances: sent }); } catch (err) {
          if (err.kind !== 'param') throw err;
          // Refused. The page checks the numbers itself, so the cause is a key the Worker does not know (this page's
          // PROGRAMS newer than the Worker's PROGRAM_NAME). Send the keys one at a time and keep the ones it takes.
          if (keys.length === 1) refused.push(keys[0]);
          else for (const k of keys) {
            try { r = await call('PUT', '/me/wallet', { balances: { [k]: sent[k] } }); } catch (e) { if (e.kind !== 'param') throw e; refused.push(k); }
          }
          if (!r) r = await call('GET', '/me/wallet');   // none went through: show what the server has
        }
      }
      for (const k of refused) dirty.delete(k);   // never resent; adopt() puts the server's value back on screen
      for (const [k, v] of Object.entries(sent)) if ((bal[k] || 0) === v) dirty.delete(k);
      loaded = true;
      adopt(r);
      if (refused.length) setStatus('refused', refused.map(k => (PROGRAMS[k] ? prog(k).name : BANK_NAME[k] || k)).join(t('、')));
      else setStatus(put ? 'saved' : 'idle');
    } catch (err) {
      setStatus(put ? 'error' : 'loadErr', err.message);
    } finally {
      busy = false;
      if (again) { again = false; if (dirty.size) sync(); }
    }
  }
  // The local copy belongs to the account that wrote it. When someone else is signed in now, drop it (unsent edits
  // too) before anything is drawn or sent; their own balances come from the server. A copy with no owner yet
  // (written before the first sign-in check) becomes this account's.
  function claim() {
    const me = ME && ME.email ? String(ME.email).toLowerCase() : '';
    if (!me || owner === me) return;
    const other = !!owner;
    owner = me;
    if (other) { bal = {}; dirty.clear(); at = null; status = ['idle']; loaded = false; }
    persist();
    if (other) changed();
  }
  // after the balances changed: cards, open details, the switch (the list itself only when it filters), and the
  // page unless the change came from typing on it
  function changed(fromPage) {
    memo.clear();
    if (S.rows && S.prefs.walletOnly) render();
    else { decorate(); drawIndicator(); const f = $('#wallet-f'); if (f) drawSwitch(f); }
    if (!fromPage) refreshPage();
  }

  /* ---------- the page ---------- */
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#3E3A39" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><path d="M5.2 8.4 15 4.6a1.7 1.7 0 0 1 2.3 1.6v2.2" fill="#A8D3E6"/><rect x="2.8" y="8.4" width="18.4" height="12.2" rx="3" fill="#F6D27A"/><path d="M21.2 12.3h-3.9a2.1 2.1 0 0 0 0 4.2h3.9z" fill="#FFFCF6"/></g></svg>';
  const progCount = () => {
    const filled = Object.keys(bal).filter(k => PROGRAMS[k]).length;
    return filled ? t('已填 {0} 個', filled) : t('{0} 個計畫', Object.keys(PROGRAMS).length);
  };
  const val = k => (bal[k] ? fmtMiles(bal[k]) : '');
  const field = k => '<input data-wk="' + k + '" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" maxlength="11" placeholder="0" value="' + val(k) + '">';
  function pageHtml() {
    const card = ([k, name]) => {
      const [c, sub] = LOOK[k] || ['water', ''];
      return '<label class="wallet-c' + (bal[k] ? ' on' : '') + '" data-k="' + k + '" style="--b:var(--' + c + ');--bt:var(--' + c + '-t)">' +
        '<span class="wallet-band"><b>' + esc(name) + '</b><i class="wallet-chip" aria-hidden="true"></i></span>' +
        '<small class="wallet-sub">' + esc(sub) + '</small>' +
        '<span class="wallet-v">' + field(k) + '<span class="wallet-u">' + t('點') + '</span></span></label>';
    };
    const groups = ALLIANCES.map(a => '<div class="pgh" style="--c:var(--' + a.k + ')"><span class="dot"></span>' + esc(a.name) + '</div>' +
      Object.entries(PROGRAMS).filter(([, p]) => p[2] === a.k).map(([k, p]) =>
        '<label class="wallet-pr' + (bal[k] ? ' on' : '') + '">' + logo(PROGRAM_CODE[k] || '') + '<span class="wallet-pn"><b>' + esc(p[0]) + '</b><small>' + esc(p[1]) + '</small></span>' + field(k) + '</label>').join('')).join('');
    return '<p class="wallet-intro">' + t('填上你有的點數，搜尋結果的每一筆就會標出：點數夠不夠、該從哪家轉、還差多少。') + '</p>' +
      '<div class="wallet-w"><div class="wallet-cards" role="group" aria-label="' + t('銀行和飯店點數') + '">' + BANKS.map(card).join('') + '</div></div>' +
      '<p class="wallet-st" id="wallet-st" role="status" aria-live="polite" tabindex="-1"></p>' +
      '<details class="wallet-pl" id="wallet-pl"' + (progsOpen ? ' open' : '') + '><summary><span class="wallet-pi">' + PLANE + '</span><span>' + t('航空里程') + '</span><span class="wallet-pc" id="wallet-pc">' + progCount() + '</span></summary>' +
        '<div class="wallet-pb">' + groups + '</div></details>' +
      '<div class="acard w wallet-how"><p class="note0">' + t('搜尋結果的「更多篩選」裡有「只看我付得起的」：打開就只列出點數夠、或轉一次點就夠的位子。') + '</p>' +
        '<p class="note0">' + t('比例是 {0} 查證的，常會調整，轉點前先到銀行網站確認。轉出去就不能退回。', TRANSFER_AS_OF) + '</p>' +
        '<p class="note0">' + t('點數存在你的帳號裡，只有你看得到；換手機登入也一樣。') + '</p>' +
        '<button type="button" class="btn ghost wallet-clr" id="wallet-clear">' + t('清除全部') + '</button></div>';
  }
  function drawStatus() {
    const el = $('#wallet-st');
    if (!el) return;
    const [kind, msg] = status;
    const retry = ' <button type="button" class="btn ghost wallet-retry" data-wretry="1">' + t('再試一次') + '</button>';
    const html = kind === 'saving' ? t('儲存中…') : kind === 'loading' ? t('讀取中…') : kind === 'saved' ? t('✓ 已儲存')
      : kind === 'error' ? esc(t('沒存到：{0}', msg)) + retry
      : kind === 'loadErr' ? esc(t('讀不到帳號裡的點數：{0}', msg)) + retry
      : kind === 'refused' ? esc(t('{0} 的點數還不能存進帳號，已經拿掉了。', msg))
      : at ? t('上次更新：{0}', since(at)) : hasAny() ? '' : t('還沒有填任何點數');
    if (el.dataset.h === html) return;   // a live region: say it once, not on every keystroke
    el.dataset.h = html;
    el.className = 'wallet-st' + (kind === 'error' || kind === 'loadErr' || kind === 'refused' ? ' bad' : kind === 'saved' ? ' ok' : '');
    keepFocus(() => { el.innerHTML = html; });
  }
  function setStatus(kind, msg) { status = [kind, msg]; drawStatus(); }
  function draw() {
    const body = $('#wallet-body');
    if (!body) return;
    keepFocus(() => { body.innerHTML = pageHtml(); drawStatus(); });
  }
  // Redraw without losing a keyboard or screen reader user's place: the element that had focus gets it back (found
  // again by its id, field key or role), or the status line when it is gone (a retry button that did its job).
  function keepFocus(redraw) {
    const body = $('#wallet-body'), a = document.activeElement;
    const inside = !!(body && a && a !== body && body.contains && body.contains(a));
    const sel = !inside ? '' : a.id ? '#' + a.id : a.dataset && a.dataset.wk ? '[data-wk="' + a.dataset.wk + '"]'
      : a.dataset && a.dataset.wretry ? '[data-wretry]' : a.tagName === 'SUMMARY' ? '#wallet-pl summary' : '';
    redraw();
    if (!inside || a.isConnected) return;
    const el = (sel && body.querySelector(sel)) || $('#wallet-st');
    if (el && el.focus) el.focus({ preventScroll: true });
  }
  // new balances while the page is open: redraw it, or, while a field is being typed in, only the other fields
  function refreshPage() {
    const sec = $('#view-wallet');
    if (!sec || sec.hidden) return;
    const typing = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.wk;
    if (!typing) { draw(); return; }
    for (const inp of $$('#wallet-body [data-wk]')) {
      if (inp === document.activeElement) continue;
      inp.value = val(inp.dataset.wk);
      inp.closest('label').classList.toggle('on', !!bal[inp.dataset.wk]);
    }
    const c = $('#wallet-pc');
    if (c) c.textContent = progCount();
    drawStatus();
  }

  addFeature({
    id: 'wallet',
    title: '點數錢包',
    route: '#/wallet',
    back: '#/',
    nav: { tab: 'me', order: 10, label: '點數錢包', icon: ICON },
    css: `
/* the wallet: stitched leather holding one card per bank; an empty card keeps a pale band, a filled one its color */
.wallet-intro{font-size:14px;margin:4px 2px 12px}
.wallet-w{position:relative;border:var(--line);border-radius:26px;background:var(--coral);padding:13px 11px 12px}
.wallet-w::before{content:"";position:absolute;inset:5px;border:2px dashed var(--ink);border-radius:20px;opacity:.5;pointer-events:none}
.wallet-cards{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 8px}
.wallet-c{display:flex;flex-direction:column;min-width:0;border:var(--line);border-radius:14px;background:var(--paper);overflow:hidden;cursor:text;transition:transform .14s ease-out}
.wallet-c[data-k=marriott]{grid-column:1/-1}
.wallet-c:focus-within{transform:translateY(-3px);background:var(--water-t)}
.wallet-band{display:flex;align-items:center;gap:6px;min-height:30px;padding:2px 8px 2px 10px;background:var(--bt);border-bottom:var(--line)}
.wallet-c.on .wallet-band{background:var(--b)}
.wallet-band b{flex:1;min-width:0;font-size:15px;line-height:1.2;overflow-wrap:anywhere}
.wallet-chip{position:relative;flex:0 0 20px;width:20px;height:15px;border:2px solid var(--ink);border-radius:4px;background:var(--yellow)}
.wallet-chip::after{content:"";position:absolute;left:3px;right:3px;top:4.5px;border-top:2px solid var(--ink)}
.wallet-sub{padding:3px 10px 0;font-size:11px;line-height:1.3;color:var(--ink2)}
.wallet-v{display:flex;align-items:baseline;gap:4px;margin-top:auto;padding:0 10px 6px}
.wallet-v input{flex:1;min-width:0;width:100%;border:0;outline:0;padding:0;background:transparent;font-size:21px;line-height:1.35;font-variant-numeric:tabular-nums;-webkit-appearance:none;appearance:none;border-radius:0}
.wallet-v input::placeholder{color:#A39C98}
.wallet-u{font-size:13px;color:var(--ink2)}
/* wider screens: three cards a row (Marriott takes two), and the airline rows in two columns */
@media (min-width:560px){.wallet-cards{grid-template-columns:repeat(3,minmax(0,1fr))}.wallet-c[data-k=marriott]{grid-column:span 2}
  .wallet-pb{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:28px}.wallet-pb .pgh{grid-column:1/-1}}
/* a 320px phone: the chip gives way, so "Capital One" stays on one line */
@media (max-width:359px){.wallet-chip{display:none}}
.wallet-st{min-height:20px;margin:6px 4px 0;font-size:13px;color:var(--ink2)}
.wallet-st:empty{display:none}
.wallet-st.ok{color:#2F6B2F}
.wallet-st.bad{color:#A33A2A}
.wallet-retry,.wallet-clr{min-height:40px;font-size:14px}
.wallet-retry{margin-left:4px;padding:1px 12px}
/* airline miles, folded away: most people keep points in the banks */
details.wallet-pl{border:var(--line);border-radius:var(--r);background:var(--paper);margin:14px 0 10px}
details.wallet-pl summary{list-style:none;display:flex;align-items:center;gap:8px;min-height:50px;padding:6px 14px;font-size:17px;cursor:pointer}
details.wallet-pl summary::-webkit-details-marker{display:none}
details.wallet-pl summary::after{content:"＋";margin-left:2px}
details.wallet-pl[open] summary::after{content:"－"}
.wallet-pi svg{width:24px;height:24px}
.wallet-pc{margin-left:auto;font-size:13px;color:var(--ink2);text-align:right}
.wallet-pb{padding:0 14px 12px}
.wallet-pb .pgh{margin:10px 0 2px}
.wallet-pr{display:flex;align-items:center;gap:8px;min-height:48px;padding:5px 0;border-bottom:2px dashed var(--ink);cursor:text}
.wallet-pr:last-child{border-bottom:0}
.wallet-pr .lg{margin:0}
.wallet-pn{flex:1;min-width:0;line-height:1.25}
.wallet-pn b{display:block;font-weight:normal;font-size:15px;overflow-wrap:anywhere}
.wallet-pn small{display:block;font-size:12px;color:var(--ink2);overflow-wrap:anywhere}
.wallet-pr input{flex:0 0 6.6em;width:6.6em;min-width:0;border:2px solid var(--ink);border-radius:12px;padding:5px 8px;background:var(--paper);font-size:17px;line-height:1.3;text-align:right;font-variant-numeric:tabular-nums;-webkit-appearance:none;appearance:none}
.wallet-pr input:focus{outline:0;background:var(--water-t)}
.wallet-pr.on input{background:var(--green-t)}
.wallet-pr.on input:focus{background:var(--water-t)}
.wallet-how .note0:last-of-type{margin-bottom:10px}
/* on the result cards and in their details */
.wallet-ln{display:block;margin-top:4px;font-size:13px;line-height:1.45;color:var(--ink2)}
.wallet-ln.ok{color:var(--ink)}
.wallet-ln.ok span{background:linear-gradient(transparent 58%,var(--green) 58%);padding:0 2px}
.wallet-d{margin-top:10px;padding-top:10px;border-top:2px dashed var(--ink)}
.wallet-d:empty{display:none}
.wallet-dh{display:flex;align-items:baseline;justify-content:space-between;gap:4px 10px;flex-wrap:wrap}
.wallet-dh b{font-weight:normal;font-size:15px}
.wallet-dh a{font-size:13px;white-space:nowrap;padding:10px 0;margin:-10px 0}
.wallet-d ul{list-style:none;margin:6px 0 4px;padding:0}
.wallet-d li{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 10px;padding:3px 0}
.wallet-db{min-width:88px;font-size:14px}
.wallet-dn{min-width:86px;font-size:14px;color:var(--ink2);font-variant-numeric:tabular-nums}
.wallet-dv{font-size:14px;font-variant-numeric:tabular-nums}
.wallet-d li.ok .wallet-dv{background:linear-gradient(transparent 58%,var(--green) 58%);padding:0 2px}
.wallet-d .note0{font-size:11px;margin:4px 0 0}
/* the 只看我付得起的 switch in 更多篩選 */
.wallet-f{margin-top:12px}
.wallet-f .switch{min-height:40px}
.wallet-f .switch input:disabled+.tr{opacity:.4}
.wallet-f .switch input:disabled~span{color:var(--ink2)}
.wallet-fh{margin:0 0 4px 54px;font-size:12px;color:var(--ink2)}
.wallet-fh a{display:inline-block;padding:11px 0;margin:-11px 0}
.wallet-on{border:0;background:none;padding:7px 0;margin:-7px 0;font-size:14px}
.wallet-on span{display:inline-flex;align-items:center;border:var(--line);border-radius:999px;background:var(--green);padding:0 10px;transition:transform .12s ease-out}
.wallet-on:active span{transform:scale(.95)}
/* an empty list while the switch hides awards */
.wallet-e{margin:10px 0 0;font-size:14px}
.wallet-e span{display:block}
.wallet-e .btn{min-height:40px;margin-top:8px;font-size:14px}
`,
    en: {
      '點數錢包': 'Wallet',
      '你的 {0} 夠': 'Your {0} balance covers it',
      '從 {0} 移 {1} Avios 過去就夠': 'Covered by moving {1} Avios from {0}',
      '你的 Avios 還差 {0} 哩': 'Your Avios are {0} miles short',
      '✓ 移 {0} 過去就夠': '✓ Enough: move {0}',
      '可移 {0} 過去': 'Can move {0}',
      '要轉的點數已經扣掉你在這幾個計畫的 {0} Avios。': 'Transfers count your {0} Avios in these programs first.',
      '{0} 的點數還不能存進帳號，已經拿掉了。': "{0} can't be saved to your account yet, so it was removed.",
      '「只看我付得起的」開著，點數不夠的位子都先藏起來了。': '"Only what I can afford" is on, so awards your points do not cover are hidden.',
      '關掉這個篩選': 'Turn this filter off',
      '用 {0} 轉 {1} 點就夠': 'Covered by {1} {0} points',
      '再用 {0} 轉 {1} 點就夠': 'Top up with {1} {0} points',
      '{0} 還差 {1} 點': '{1} {0} points short',
      '你的 {0} 還差 {1} 哩': 'Your {0} is {1} miles short',
      '你的點數轉不過去': 'None of your points reach this',
      '（{0} 人）': ' (for {0})',
      '✓ 夠': '✓ Enough',
      '還差 {0} 哩': '{0} miles short',
      '還沒填': 'Not set',
      '✓ 轉 {0} 點就夠': '✓ Enough: transfer {0}',
      '還差 {0} 點': '{0} pts short',
      '你的點數（{0} 人共 {1} 哩）': 'Your points: {0} people, {1} miles',
      '你的點數（{0} 哩）': 'Your points for {0} miles',
      '要轉的點數已經扣掉你的 {0} {1} 哩。': 'Transfers count your {1} {0} miles first.',
      '改點數': 'Edit points',
      '用點數錢包的餘額算：直接夠，或轉一次點就夠。': 'Uses your wallet: covered as is, or after one transfer.',
      '點數錢包還是空的。': 'Your points wallet is empty.',
      '先去填點數': 'Add your points',
      '只看我付得起的': 'Only what I can afford',
      '只看付得起的': 'Affordable only',
      '關掉「只看付得起的」': 'Turn off "Affordable only"',
      '已填 {0} 個': '{0} filled',
      '點': 'pts',
      '填上你有的點數，搜尋結果的每一筆就會標出：點數夠不夠、該從哪家轉、還差多少。': 'Enter your balances, and each search result shows whether your points cover it, which bank to transfer from, or how many you are short.',
      '銀行和飯店點數': 'Bank and hotel points',
      '航空里程': 'Airline miles',
      '搜尋結果的「更多篩選」裡有「只看我付得起的」：打開就只列出點數夠、或轉一次點就夠的位子。': 'Turn on "Only what I can afford" under More filters on the results to list only awards your points cover, as is or after one transfer.',
      '點數存在你的帳號裡，只有你看得到；換手機登入也一樣。': 'Your balances are kept in your account. Only you can see them, on any device you sign in on.',
      '清除全部': 'Clear all',
      '儲存中…': 'Saving…',
      '✓ 已儲存': '✓ Saved',
      '沒存到：{0}': 'Not saved: {0}',
      '讀不到帳號裡的點數：{0}': "Couldn't load your saved points: {0}",
      '上次更新：{0}': 'Last updated {0}',
      '還沒有填任何點數': 'No balances yet',
      '把點數錢包的點數全部清掉？': 'Clear every balance in your points wallet?',
      '點數錢包清空了': 'Points wallet cleared',
    },
    show() {
      claim();   // route() draws this page before onAuth runs
      draw();
      if (!loaded && !busy) sync();   // read once a session (onAuth normally has)
    },
    onAuth() { claim(); sync(); },
    onRender() { decorate(); drawIndicator(); markFilters(); },
    active: () => !!S.prefs.walletOnly && hasAny(),   // counted by the page's activeConds()
    onDetails(art, box) {
      let d = box.querySelector('.wallet-d');
      if (!d) {
        d = document.createElement('div');
        d.className = 'wallet-d';
        const x = box.querySelector('.xfer');
        if (x) x.after(d); else box.appendChild(d);
      }
      fillDetails(art);
    },
    onFilters(el) {
      let box = el.querySelector('#wallet-f');
      if (!box) { box = document.createElement('div'); box.id = 'wallet-f'; box.className = 'wallet-f'; el.appendChild(box); }
      drawSwitch(box);
    },
    filter(x) {
      if (!S.prefs.walletOnly || !hasAny()) return true;
      return judge(x.src, x.miles).ok;
    },
  });

  const body = $('#wallet-body');
  body.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.wk;
    if (!k || !keyOK(k)) return;
    const v = Math.min(MAX, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0);
    const lab = e.target.closest('label');
    if (lab) lab.classList.toggle('on', v > 0);
    if ((bal[k] || 0) === v) return;
    if (v) bal[k] = v; else delete bal[k];
    dirty.add(k);
    persist();
    memo.clear();
    const c = $('#wallet-pc');
    if (c && PROGRAMS[k]) c.textContent = progCount();
    setStatus('saving');
    clearTimeout(timer);
    timer = setTimeout(() => { sync(); changed(true); }, SAVE_MS);
  });
  // a field shows its number with commas once you leave it
  body.addEventListener('focusout', e => { const k = e.target.dataset && e.target.dataset.wk; if (k) e.target.value = val(k); });
  body.addEventListener('toggle', e => { if (e.target.id === 'wallet-pl') progsOpen = e.target.open; }, true);
  body.addEventListener('click', e => {
    if (e.target.closest('[data-wretry]')) { sync(); return; }
    if (!e.target.closest('#wallet-clear')) return;
    if (!hasAny()) { setStatus('idle'); return; }
    if (!confirm(t('把點數錢包的點數全部清掉？'))) return;
    for (const k of Object.keys(bal)) dirty.add(k);
    bal = {};
    persist();
    clearTimeout(timer);
    sync();
    changed();
    toast(t('點數錢包清空了'));
  });

  // another tab of the site changed the wallet: take its balances (edits waiting to be saved here still win). Not
  // written back, so two tabs can't bounce it between them.
  addEventListener('storage', e => {
    if (e.key !== LS || !e.newValue) return;
    let x = null;
    try { x = JSON.parse(e.newValue); } catch { return; }
    if (!x || !owner || x.email !== owner) return;
    const next = clean(x.b);
    for (const k of dirty) { if (bal[k]) next[k] = bal[k]; else delete next[k]; }
    bal = next;
    if (Number.isFinite(x.at)) at = x.at;
    changed();
  });

  // for other features: a copy of the balances, whether they cover an award (miles per person; 人數 applied), and
  // the card's 💳 line for it ('' when the wallet is empty or has nothing to say)
  window.WALLET = {
    balances: () => Object.assign({}, bal),
    covers: (src, miles) => hasAny() && +miles > 0 && judge(src, +miles).ok,
    line: (src, miles) => (hasAny() && +miles > 0 ? lineText(src, judge(src, +miles)) : ''),
  };
})();
