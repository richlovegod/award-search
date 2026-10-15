// 推播通知 (Web Push for alerts) and the installable web app, 2026-10-15.
// - Registers sw.js (scope '/'): the offline copy of the page, and the push and notification-tap handlers.
// - Adds a 📱 推播通知 card to 我的提醒. On iPhone, push needs iOS 16.4 or later and the site opened from its Home
//   Screen icon, so in Safari the card walks through 加入主畫面 first. 開啟推播 asks for permission (straight from
//   the tap, as iOS requires), subscribes with the Worker's VAPID key (GET /push/key) and registers the
//   subscription (POST /me/push); 測試推播 sends one to every device of the account; 關閉 unsubscribes this device
//   first and then drops its row (DELETE /me/push). The account's devices are listed, this one marked 這台 (a row's
//   id is the SHA-256 of its endpoint, which this page can compute from its own subscription).
// - Push follows sign-in: the Worker ties each subscription to the sign-in that registered it, so 登出, 登出其他所有
//   裝置, a password change or an expired sign-in stops that device's pushes. After each sign-in, a subscription
//   this browser already holds is registered again (no prompt), so pushes resume and follow whoever is signed in.
(() => {
  'use strict';
  const MARK = 'award-push';            // { id, tok }: the subscription this browser last registered, and for which sign-in
  const FRESH_MS = 5 * 60 * 1000;       // the device list (and a missing key) is asked for again after 5 minutes
  const ERRS = {
    push_off: '推播還沒開通：要等管理員設定好。',
    push_max: '最多 {0} 台裝置。先移除一台，再開啟推播。',
    push_bad: '這台裝置給的推播資料不對。關閉後再開啟一次試試。',
    push_rate: '測試推播一小時最多 5 次，請晚一點再試。',
    push_none: '還沒有裝置開啟推播。',
  };
  // what is known so far; sub: undefined = not looked at yet, null = none on this device; keyAt: when the key was asked
  const P = { box: null, key: null, keyAt: 0, off: false, devices: null, max: 10, at: 0, listErr: null, sub: undefined, subId: null, busy: '', msg: null, swErr: '' };

  /* ---------- what this device can do ---------- */
  const UA = navigator.userAgent;
  const IOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
  const pushOK = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  // the iOS version, when the browser says it (iPadOS in desktop mode shows a Mac's, so none)
  const iosVer = () => { const m = /iPhone|iPad|iPod/.test(UA) && /OS (\d+)_(\d+)/.exec(UA); return m ? [+m[1], +m[2]] : null; };
  const tooOld = v => !!v && (v[0] < 16 || (v[0] === 16 && v[1] < 4));

  /* ---------- the service worker ---------- */
  // On the real site it is registered at every page load. On this computer's test server (LOCAL, from index.html)
  // only when asked: 開啟推播, or localStorage 'award-sw' = '1'. Once a worker controls the page, WebKit sends the
  // page's fetches past Playwright's page.route (tried 2026-10-15: the mock was skipped and staging answered), so a
  // worker there would let every test that mocks /search reach the real seats.aero.
  const SW_FLAG = 'award-sw';
  const swWanted = () => !LOCAL || localStorage.getItem(SW_FLAG) === '1';
  let REG = null;   // promise of the registration, or of null when it failed
  function registerSW() {
    if (REG) return REG;
    try {
      if (!('serviceWorker' in navigator)) return (REG = Promise.resolve(null));
      REG = navigator.serviceWorker.register('sw.js').catch(e => { P.swErr = String(e && e.message || e); return null; });
      navigator.serviceWorker.addEventListener('message', onMessage);
      if (navigator.serviceWorker.startMessages) navigator.serviceWorker.startMessages();
    } catch (e) {
      P.swErr = String(e && e.message || e);
      REG = Promise.resolve(null);
    }
    return REG;
  }
  if (swWanted()) { if (document.readyState === 'complete') registerSW(); else addEventListener('load', registerSW, { once: true }); }
  // the registration once it has an active worker (pushManager.subscribe needs one), or null; registers if needed
  async function readyReg(ms = 10000) {
    if (LOCAL) localStorage.setItem(SW_FLAG, '1');
    const r = await registerSW();
    if (!r) return null;
    if (r.active) return r;
    return Promise.race([navigator.serviceWorker.ready, new Promise(res => setTimeout(() => res(null), ms))]);
  }
  // this device's subscription, or null; only looks, never registers a worker
  async function getSub() {
    try {
      const r = REG ? await REG : 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      return r && r.pushManager ? (await r.pushManager.getSubscription()) || null : null;
    } catch { return null; }
  }
  // a tapped notification: the service worker brought this window forward; go to the alert it names
  function onMessage(e) {
    const d = e.data;
    if (!d || d.type !== 'push-open' || typeof d.url !== 'string') return;
    let u;
    try { u = new URL(d.url, location.href); } catch { return; }
    if (u.origin !== location.origin) return;
    const page = p => p.replace(/index\.html$/, '');
    if (page(u.pathname) !== page(location.pathname)) { location.href = u.href; return; }
    if (location.hash !== u.hash) location.hash = u.hash;
    else if (!$('#app').hidden) route();
  }

  /* ---------- small helpers ---------- */
  async function sha(s) {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
    return btoa(String.fromCharCode(...d)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // which sign-in registered the subscription: a short hash of the session token, so a new sign-in registers again
  const tokTag = async () => { const k = getToken(); return k ? (await sha(k)).slice(0, 16) : ''; };
  const unb64 = s => { const b = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(b + '='.repeat((4 - b.length % 4) % 4)), c => c.charCodeAt(0)); };
  // a subscription made with another key (the Worker's key pair was replaced) must be made again
  function sameKey(sub, key) {
    const k = sub.options && sub.options.applicationServerKey;
    if (!k) return true;
    const a = new Uint8Array(k), b = unb64(key);
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  function devName(ua) {
    ua = ua || '';
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'Mac'
      : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '';
    const br = /Edg[A-Z]?\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) || /iPhone|iPad/.test(ua) ? 'Safari' : '';
    return [os, br].filter(Boolean).join(' ') || t('不明的裝置');
  }
  // an error from call() or from the browser, in the language on screen
  function errText(err) {
    if (!err) return '';
    if (isOff(err)) return t(ERRS.push_off);
    if (ERRS[err.kind]) return t(ERRS[err.kind], P.max);
    if (err.kind === 'network') return t('連不上伺服器，請檢查網路。');
    if (err.kind) return ERR[err.kind] ? t(ERR[err.kind]) : err.message;
    if (err.name === 'NotAllowedError') return t('你沒有允許通知，所以開不了推播。');
    if (err.message === 'no-sw') return t('網站的背景程式沒有載入。重新整理頁面再試一次。');
    return t('開啟推播失敗：{0}', String(err.message || err.name || err));
  }
  // the card's message line; f makes the text, so a language switch redraws it in the new language
  const say = (f, ok) => { P.msg = { f, ok: !!ok }; draw(); };
  const setBusy = x => { P.busy = x; if (x) acted++; draw(); };
  // before the Worker has this feature its routes answer 404, which means the same as not set up
  const isOff = err => err && (err.kind === 'push_off' || err.kind === 'not_found');

  /* ---------- drawing ---------- */
  const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#3E3A39" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 9.5H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1.5" fill="#A8D3E6"/><path d="M12 3.5v11M8.6 6.9 12 3.5l3.4 3.4"/></g></svg>';
  const ADD = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#3E3A39" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4.5" fill="#F6D27A"/><path d="M12 8.5v7M8.5 12h7"/></g></svg>';
  // while something runs, buttons are aria-disabled (not disabled), so the one just tapped keeps keyboard focus
  const dis = () => (P.busy ? ' aria-disabled="true"' : '');
  const btn = (act, label, cls) => '<button type="button" class="btn ' + cls + '" data-push="' + act + '"' + dis() + '>' + (P.busy === act ? t('處理中…') : label) + '</button>';
  const acts = inner => '<div class="push-acts">' + inner + '</div>';
  const para = (cls, x) => '<p class="' + cls + '">' + x + '</p>';

  function homeSteps() {
    // role=list: WebKit drops a list's meaning for VoiceOver when list-style is none
    return para('mstate', t('iPhone 要 iOS 16.4 以上，而且要從主畫面的圖示打開這個網站，才收得到推播：')) +
      '<ol class="push-steps" role="list">' +
      '<li><span class="push-ico">' + SHARE + '</span><span>' + t('按 Safari 的分享按鈕（找不到就先按「⋯」）') + '</span></li>' +
      '<li><span class="push-ico">' + ADD + '</span><span>' + t('往下滑，選「加入主畫面」') + '</span></li>' +
      '<li><span class="push-ico push-app">' + MASCOT + '</span><span>' + t('從主畫面的新圖示打開，登入後到「我的提醒」按「開啟推播」') + '</span></li>' +
      '</ol>' + para('note0', t('主畫面的 App 跟 Safari 分開登入，所以要再登入一次。'));
  }
  function stateHtml() {
    if (!pushOK()) {
      const v = iosVer();
      if (tooOld(v)) return para('mstate', t('這台裝置是 iOS {0}，推播要 iOS 16.4 以上。', v.join('.'))) + para('note0', t('到「設定 > 一般 > 軟體更新」更新之後再回來。'));
      if (IOS && standalone()) return para('mstate', t('這個主畫面 App 收不到推播，要 iOS 16.4 以上。')) + para('note0', t('到「設定 > 一般 > 軟體更新」更新之後再回來。'));
      if (IOS) return homeSteps();
      return para('mstate', t('這個瀏覽器收不到推播通知。')) + para('note0', t('電腦和 Android 可以用 Chrome、Edge 或 Firefox；iPhone 要用 Safari 把網站加入主畫面。'));
    }
    if (P.off) return para('mstate', t(ERRS.push_off)) + (ME && ME.role === 'owner' ? para('note0', t('管理員：把 vapid.json 的金鑰存到 Worker 的 VAPID_PUBLIC 和 VAPID_PRIVATE_JWK。')) : '');
    if (P.sub === undefined) return para('mstate', t('讀取中…'));
    const perm = Notification.permission;
    const linked = !!P.subId && !!P.devices && P.devices.some(d => d.id === P.subId);
    const test = P.devices && P.devices.length ? btn('test', t('測試推播'), '') : '';
    if (P.sub && linked && perm === 'granted') return para('mstate ok', t('✅ 這台裝置會收到推播')) + acts(btn('test', t('測試推播'), 'pri') + btn('off', t('關閉'), 'ghost'));
    // whether this device is linked is only known from the list: while it loads, wait; if it failed, say no more
    // than is known (the list's own error is shown below), and 開啟推播 links it again and reads the list again
    if (P.sub && perm === 'granted' && !P.devices) {
      return P.listErr ? para('mstate', t('這台裝置允許了通知，但現在讀不到裝置清單。')) + acts(btn('on', t('開啟推播'), 'pri')) : para('mstate', t('讀取中…'));
    }
    if (perm === 'denied') {
      return para('mstate', t('這台裝置封鎖了這個網站的通知。')) +
        para('note0', IOS ? t('到 iPhone 的「設定 > 通知」，點這個 App，打開「允許通知」，再回來按「開啟推播」。') : t('到瀏覽器的網站設定，允許這個網站傳送通知，再回來按「開啟推播」。')) +
        acts(btn('on', t('開啟推播'), 'pri') + test);
    }
    const lead = P.sub && perm === 'granted' ? t('這台裝置允許了通知，但還沒連到你的帳號。按「開啟推播」連上。')
      : IOS && standalone() ? t('你是從主畫面打開的，可以開啟推播了。') : t('這台裝置還沒開啟推播。');
    return para('mstate', lead) + acts(btn('on', t('開啟推播'), 'pri') + test) + (perm === 'granted' ? '' : para('note0', t('按下去之後選「允許」，這個網站才能傳通知給你。')));
  }
  function devicesHtml() {
    if (!P.devices) return P.listErr && !isOff(P.listErr) ? para('msg bad', esc(errText(P.listErr))) : '';
    const rows = P.devices.map(d => {
      const failed = d.last_err && (!d.last_ok_at || d.last_err_at >= d.last_ok_at);
      // never delivered: its failure says more than 還沒送過, so only one of the two is shown
      const bits = [t('開啟：{0}', fmtDay(d.created_at)), d.last_ok_at ? t('上次送達：{0}', since(d.last_ok_at)) : failed ? '' : t('還沒送過'), failed ? t('上次失敗：{0}', esc(d.last_err)) : ''];
      const name = devName(d.ua);
      return '<div class="rowi push-dev"><div class="main"><b>' + esc(name) + (d.id === P.subId ? '<span class="tag me">' + t('這台') + '</span>' : '') + '</b>' +
        '<small>' + bits.filter(Boolean).map(x => '<span>' + x + '</span>').join('') + '</small></div>' +
        '<div class="acts"><button type="button" class="btn ghost" data-push-del="' + esc(d.id) + '" aria-label="' + esc(t('移除 {0}（{1} 開啟）', name, fmtDay(d.created_at))) + '"' + dis() + '>' + t('移除') + '</button></div></div>';
    }).join('');
    return '<div class="push-devs"><p class="lbl">' + t('收推播的裝置（{0}/{1}）', P.devices.length, P.max) + '</p>' + (rows || para('note0', t(ERRS.push_none))) +
      para('note0 push-follow', t('推播跟著登入走：裝置登出或登入過期就停，在那台再登入就會自動恢復。')) + '</div>';
  }
  // a part of the card, replaced only when it changed (so a refresh that read the same list keeps the buttons)
  function put(el, html) { if (el && el.pushHtml !== html) { el.pushHtml = html; el.innerHTML = html; } }
  // the focused control, as a selector that finds its redrawn copy
  function focusKey(box) {
    const a = document.activeElement;
    if (!a || a === box || !box.contains(a)) return null;
    if (a.dataset.push) return '[data-push="' + a.dataset.push + '"]';
    if (a.dataset.pushDel) return '[data-push-del="' + CSS.escape(a.dataset.pushDel) + '"]';
    return a.id === 'push-msg' ? '#push-msg' : null;
  }
  function draw() {
    const box = P.box;
    if (!box || !box.isConnected) return;
    // the message line stays the same node, so screen readers announce what it says next (role=status)
    if (!box.querySelector('#push-msg')) box.innerHTML = '<h3></h3><p class="note0 push-lead"></p><div class="push-state"></div><p class="msg" id="push-msg" role="status" tabindex="-1"></p><div class="push-list"></div>';
    const had = focusKey(box);
    put(box.querySelector('h3'), esc(t('📱 推播通知')));
    put(box.querySelector('.push-lead'), esc(t('提醒找到新位子、寄信給你的時候，也會在開啟推播的裝置上跳出通知。')));
    put(box.querySelector('.push-state'), stateHtml());
    put(box.querySelector('.push-list'), devicesHtml());
    const m = box.querySelector('#push-msg'), cls = 'msg' + (P.msg ? (P.msg.ok ? ' ok' : ' bad') : ''), text = P.msg ? P.msg.f() : '';
    if (m.className !== cls) m.className = cls;
    if (m.textContent !== text) m.textContent = text;
    // the tapped button was redrawn (or is gone, e.g. 開啟推播 once push is on): focus its copy, else the card's
    // first button, else the message, so keyboard and VoiceOver users are not sent back to the top of the page
    if (had && !box.contains(document.activeElement)) {
      const to = box.querySelector(had) || box.querySelector('.push-acts .btn') || m;
      try { to.focus({ preventScroll: true }); } catch { to.focus(); }
    }
  }

  /* ---------- reading ---------- */
  async function loadDevices() {
    try {
      const r = await call('GET', '/me/push');
      P.devices = r.devices || []; P.max = r.max || P.max; P.at = Date.now(); P.listErr = null;
      if (typeof r.ready === 'boolean') P.off = !r.ready;
    } catch (err) {
      P.listErr = err;
      if (isOff(err)) P.off = true;
    }
  }
  // the Worker's VAPID public key (kept for the session). While the Worker has none (P.off), the answer is kept for
  // FRESH_MS too, so revisits and language switches cost no call; 開啟推播 (fresh) always asks.
  async function loadKey(fresh) {
    if (P.key) return P.key;
    if (!fresh && P.keyAt && Date.now() - P.keyAt < FRESH_MS) return null;
    try {
      const r = await call('GET', '/push/key');
      P.key = typeof r.key === 'string' && r.key ? r.key : null;
      P.off = !P.key;
      P.keyAt = Date.now();
    } catch (err) {
      if (!isOff(err)) throw err;
      P.off = true;
      P.keyAt = Date.now();
    }
    return P.key;
  }
  let loading = null, acted = 0;   // acted: counts actions, so a slower look started before one can't undo it
  function refresh() {
    if (loading) return loading;
    const jobs = [], at = acted;
    if (!P.devices || Date.now() - P.at > FRESH_MS) jobs.push(loadDevices());
    if (pushOK()) {
      if (!P.key) jobs.push(loadKey().catch(() => {}));
      jobs.push(getSub().then(async s => {
        const id = s ? await sha(s.endpoint) : null;
        if (at === acted) { P.sub = s || null; P.subId = id; }
      }, () => {}));
    }
    loading = Promise.all(jobs).finally(() => { loading = null; draw(); });
    return loading;
  }

  /* ---------- actions ---------- */
  function askPermission() {
    return new Promise(res => {
      try {
        const p = Notification.requestPermission(res);   // old Safari answers through the callback only
        if (p && p.then) p.then(res, () => res(Notification.permission));
      } catch { res(Notification.permission); }
    });
  }
  async function register(sub) {
    const j = sub.toJSON(), tok = await tokTag();
    await call('POST', '/me/push', { endpoint: j.endpoint, keys: j.keys, ua: navigator.userAgent });
    save(MARK, { id: await sha(j.endpoint), tok });
  }
  async function turnOn() {
    if (!pushOK() || P.busy) return;
    // the permission prompt comes first, before anything else waits, or iOS does not show it
    const asked = Notification.permission === 'granted' ? Promise.resolve('granted') : askPermission();
    setBusy('on');
    try {
      const perm = await asked;
      // denied: the card itself now says how to allow it again; dismissed: say how to try again
      if (perm !== 'granted') { P.msg = perm === 'denied' ? null : { f: () => t('還沒有允許通知。再按一次「開啟推播」，然後選「允許」。') }; return; }
      const reg = await readyReg();
      if (!reg) throw new Error('no-sw');
      if (!(await loadKey(true))) { P.msg = null; return; }   // the Worker has no keys yet: the card says so
      let sub = await reg.pushManager.getSubscription();
      if (sub && !sameKey(sub, P.key)) { await sub.unsubscribe().catch(() => {}); sub = null; }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64(P.key) });
      await register(sub);
      P.sub = sub; P.subId = await sha(sub.endpoint);
      await loadDevices();
      say(() => t('推播開好了。按「測試推播」試一次。'), true);
    } catch (err) {
      if (isOff(err)) P.off = true;
      say(() => errText(err));
    } finally { setBusy(''); }
  }
  async function turnOff() {
    if (P.busy) return;
    setBusy('off');
    try {
      const sub = P.sub || await getSub().catch(() => null);
      const endpoint = sub && sub.endpoint, id = P.subId;
      // this device first, so it stops even if the Worker can't be reached; a dead endpoint is dropped at the next push
      if (sub) await sub.unsubscribe().catch(() => {});
      P.sub = null; P.subId = null;
      localStorage.removeItem(MARK);
      if (endpoint || id) await call('DELETE', '/me/push', endpoint ? { endpoint } : { id });
      await loadDevices();
      say(() => t('這台裝置不會再收到推播。'), true);
    } catch (err) { say(() => errText(err)); } finally { setBusy(''); }
  }
  async function removeDevice(id) {
    if (P.busy) return;
    if (id === P.subId) return turnOff();
    if (!confirm(t('移除這台裝置？它就不會再收到推播。'))) return;
    setBusy('del');
    try {
      await call('DELETE', '/me/push', { id });
      await loadDevices();
      say(() => t('那台裝置已移除。'), true);
    } catch (err) { say(() => errText(err)); } finally { setBusy(''); }
  }
  async function testPush() {
    if (P.busy) return;
    setBusy('test');
    try {
      const r = await call('POST', '/me/push/test', { lang: LANG });
      await loadDevices();
      say(() => {
        if (!r.sent && !r.failed) return t('那些裝置都失效了，已移除。在要收通知的裝置上再開啟一次推播。');
        return [r.sent ? t('測試推播送出了（{0} 台），等一下就會跳出通知。', r.sent) : '', r.removed ? t('{0} 台失效的裝置已移除。', r.removed) : '',
          r.failed ? t('{0} 台送不出去，原因在下面的「上次失敗」。', r.failed) : ''].filter(Boolean).join(' ');
      }, r.sent > 0);
    } catch (err) { say(() => errText(err)); } finally { setBusy(''); }
  }
  // delegated: the card is drawn again whenever 我的提醒 is
  $('#alerts-body').addEventListener('click', e => {
    const b = e.target.closest('#push-card button');
    if (!b || P.busy || b.getAttribute('aria-disabled') === 'true') return;
    if (b.dataset.push === 'on') turnOn();
    else if (b.dataset.push === 'test') testPush();
    else if (b.dataset.push === 'off') turnOff();
    else if (b.dataset.pushDel) removeDevice(b.dataset.pushDel);
  });

  // after sign-in: register this browser's subscription again for this sign-in (the Worker stops pushing to a
  // device when the sign-in that registered it ends), unless it was already registered with this one
  async function sync() {
    if (!pushOK() || Notification.permission !== 'granted' || !ME) return;
    const sub = await getSub();
    if (!sub) return;
    const id = await sha(sub.endpoint), mark = load(MARK, null);
    if (mark && mark.id === id && mark.tok && mark.tok === await tokTag()) return;
    // made with an older key pair: every push service would refuse it, so leave it for 開啟推播 to make again
    const key = await loadKey().catch(() => null);
    if (!key || !sameKey(sub, key)) return;
    await register(sub);
    P.at = 0;   // the device list changed
    if (P.box && P.box.isConnected) refresh();
  }
  // a message belongs to the visit it was shown in
  addEventListener('hashchange', () => { if (location.hash !== '#/alerts') P.msg = null; });

  addFeature({
    id: 'push',
    css: `
.push-card .push-acts{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 8px}
.push-card .push-acts .btn{min-height:42px;padding:6px 18px}
.push-card .btn[aria-disabled="true"]{opacity:.6;cursor:default}
.push-card .msg{margin:2px 0 6px}
.push-card .msg:focus{outline:none}
.push-steps{list-style:none;margin:6px 0 10px;padding:0 0 0 6px;display:grid;gap:12px;counter-reset:pushstep}
.push-steps li{display:flex;align-items:center;gap:12px;font-size:15px;line-height:1.45;counter-increment:pushstep;min-width:0}
.push-steps li>span:last-child{min-width:0;overflow-wrap:anywhere}
.push-ico{position:relative;flex:0 0 46px;width:46px;height:46px;border:var(--line);border-radius:14px;background:var(--paper);display:grid;place-items:center}
.push-ico::after{content:counter(pushstep);position:absolute;top:-9px;left:-9px;width:22px;height:22px;border:2px solid var(--ink);border-radius:50%;background:var(--coral);font-size:12px;line-height:18px;text-align:center}
.push-ico svg{width:26px;height:26px}
.push-app{background:var(--water-t)}
.push-app svg{width:32px;height:32px}
.push-devs{margin-top:12px;border-top:2px dashed var(--ink)}
.push-devs .lbl{margin:10px 0 0}
.push-devs .push-follow{margin:10px 0 0}
.push-dev .btn{position:relative;min-height:34px}
.push-dev .btn::after{content:'';position:absolute;inset:-5px -4px}
`,
    en: {
      '📱 推播通知': '📱 Push notifications',
      '提醒找到新位子、寄信給你的時候，也會在開啟推播的裝置上跳出通知。': 'When an alert emails you about new seats, your devices with push turned on also get a notification.',
      'iPhone 要 iOS 16.4 以上，而且要從主畫面的圖示打開這個網站，才收得到推播：': 'On iPhone, push needs iOS 16.4 or later, with this site opened from its Home Screen icon:',
      '按 Safari 的分享按鈕（找不到就先按「⋯」）': 'Tap the Share button in Safari (tap ⋯ first if you can\'t see it)',
      '往下滑，選「加入主畫面」': 'Scroll down and tap Add to Home Screen',
      '從主畫面的新圖示打開，登入後到「我的提醒」按「開啟推播」': 'Open the new Home Screen icon, sign in, then tap Turn on push in My alerts',
      '主畫面的 App 跟 Safari 分開登入，所以要再登入一次。': 'The Home Screen app keeps its own sign-in, so you sign in once more.',
      '這台裝置是 iOS {0}，推播要 iOS 16.4 以上。': 'This device has iOS {0}. Push needs iOS 16.4 or later.',
      '這個主畫面 App 收不到推播，要 iOS 16.4 以上。': 'This Home Screen app can\'t get push. It needs iOS 16.4 or later.',
      '到「設定 > 一般 > 軟體更新」更新之後再回來。': 'Update in Settings > General > Software Update, then come back.',
      '這個瀏覽器收不到推播通知。': 'This browser can\'t get push notifications.',
      '電腦和 Android 可以用 Chrome、Edge 或 Firefox；iPhone 要用 Safari 把網站加入主畫面。': 'On a computer or Android, use Chrome, Edge or Firefox. On iPhone, add the site to the Home Screen from Safari.',
      '推播還沒開通：要等管理員設定好。': 'Push isn\'t switched on yet: the admin has to finish the setup.',
      '管理員：把 vapid.json 的金鑰存到 Worker 的 VAPID_PUBLIC 和 VAPID_PRIVATE_JWK。': 'Admin: store the keys from vapid.json as the Worker\'s VAPID_PUBLIC and VAPID_PRIVATE_JWK.',
      '✅ 這台裝置會收到推播': '✅ This device gets push notifications',
      '測試推播': 'Send a test',
      '關閉': 'Turn off',
      '開啟推播': 'Turn on push',
      '處理中…': 'Working…',
      '這台裝置封鎖了這個網站的通知。': 'This device blocks notifications from this site.',
      '到 iPhone 的「設定 > 通知」，點這個 App，打開「允許通知」，再回來按「開啟推播」。': 'On your iPhone, open Settings > Notifications, tap this app, turn on Allow Notifications, then come back and tap Turn on push.',
      '到瀏覽器的網站設定，允許這個網站傳送通知，再回來按「開啟推播」。': 'In your browser\'s site settings, allow notifications for this site, then come back and tap Turn on push.',
      '這台裝置允許了通知，但還沒連到你的帳號。按「開啟推播」連上。': 'This device allows notifications but isn\'t linked to your account yet. Tap Turn on push to link it.',
      '這台裝置允許了通知，但現在讀不到裝置清單。': 'This device allows notifications, but the device list can\'t be read right now.',
      '你是從主畫面打開的，可以開啟推播了。': 'You opened the site from the Home Screen, so push can be turned on now.',
      '這台裝置還沒開啟推播。': 'Push is off on this device.',
      '按下去之後選「允許」，這個網站才能傳通知給你。': 'When asked, tap Allow so this site can send you notifications.',
      '收推播的裝置（{0}/{1}）': 'Devices with push ({0}/{1})',
      '開啟：{0}': 'On since {0}',
      '上次送達：{0}': 'Last delivered: {0}',
      '還沒送過': 'Nothing sent yet',
      '上次失敗：{0}': 'Last failure: {0}',
      '移除': 'Remove',
      '移除 {0}（{1} 開啟）': 'Remove {0} (on since {1})',
      '推播跟著登入走：裝置登出或登入過期就停，在那台再登入就會自動恢復。': 'Push follows sign-in: it stops on a device that signs out or whose sign-in expires, and comes back when you sign in there again.',
      '還沒有裝置開啟推播。': 'No device has push turned on yet.',
      '最多 {0} 台裝置。先移除一台，再開啟推播。': 'Up to {0} devices. Remove one, then turn on push.',
      '這台裝置給的推播資料不對。關閉後再開啟一次試試。': 'This device\'s push details were not accepted. Turn push off, then on again.',
      '測試推播一小時最多 5 次，請晚一點再試。': 'Up to 5 tests an hour. Try again later.',
      '你沒有允許通知，所以開不了推播。': 'Notifications weren\'t allowed, so push can\'t be turned on.',
      '還沒有允許通知。再按一次「開啟推播」，然後選「允許」。': 'Notifications aren\'t allowed yet. Tap Turn on push again, then tap Allow.',
      '網站的背景程式沒有載入。重新整理頁面再試一次。': 'The site\'s background helper didn\'t load. Reload the page and try again.',
      '開啟推播失敗：{0}': 'Couldn\'t turn on push: {0}',
      '推播開好了。按「測試推播」試一次。': 'Push is on. Tap Send a test to try it.',
      '這台裝置不會再收到推播。': 'This device will no longer get push notifications.',
      '移除這台裝置？它就不會再收到推播。': 'Remove this device? It will stop getting push notifications.',
      '那台裝置已移除。': 'That device was removed.',
      '那些裝置都失效了，已移除。在要收通知的裝置上再開啟一次推播。': 'Those devices had expired and were removed. Turn on push again on each device you use.',
      '測試推播送出了（{0} 台），等一下就會跳出通知。': 'Test sent to your devices ({0}). It should show up in a moment.',
      '{0} 台失效的裝置已移除。': 'Expired devices removed: {0}.',
      '{0} 台送不出去，原因在下面的「上次失敗」。': 'Not delivered: {0} (see Last failure below).',
    },
    onAlertsPage(el) {
      let box = el.querySelector('#push-card');
      if (!box) {
        box = document.createElement('div');
        box.id = 'push-card';
        box.className = 'acard y push-card';
        el.appendChild(box);
      }
      P.box = box;
      draw();
      refresh();
    },
    // redraw at once in the new language; 我的提醒 itself is drawn again only after its list is read
    onLang() { draw(); },
    onAuth() {
      // another account (or the same one, signed in again) on this tab: its device list is read afresh, and this
      // browser's subscription is registered for the new sign-in
      Object.assign(P, { devices: null, at: 0, listErr: null, msg: null });
      setTimeout(() => { sync().catch(() => {}); }, 1500);
    },
  });
})();
