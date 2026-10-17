// Service worker for 吉諾機票研究所 (award.ginochang.com), 2026-10-15. Registered by features/push.js; scope '/'.
// 1. The installable web app: a page load goes to the network first (with navigation preload, so it does not wait
//    for this worker to start), and keeps the latest copy of the page; when the network fails (offline) or has not
//    answered in 4 seconds (a weak signal), that copy is shown. Nothing else is touched: the Worker's API is on
//    another origin and is never cached, and every other request goes to the network exactly as without a worker.
// 2. Push notifications for alerts: shows the Worker's { title, body, url, tag, acct }; a tap brings the site's open
//    window forward (with several, the one signed in to the alert's account) and navigates it to the alert
//    (features/push.js hears a message where that is refused), or opens a new window.
// To retire it, replace this file with one that calls self.registration.unregister().
'use strict';
const VERSION = 'v1';
const CACHE = 'award-page-' + VERSION;
const SCOPE = self.registration.scope;                    // e.g. https://award.ginochang.com/
const PAGE = new URL('index.html', SCOPE).href;           // the one cached copy of the page
const ICON = new URL('icons/icon-192.png', SCOPE).href;
const PAGE_PATHS = [new URL(SCOPE).pathname, new URL(PAGE).pathname];

self.addEventListener('install', e => {
  self.skipWaiting();
  // a first copy for offline use; failing to get one (offline right now) does not stop the install
  e.waitUntil(caches.open(CACHE).then(c => c.add(new Request(PAGE, { cache: 'reload' }))).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('award-page-') && k !== CACHE) await caches.delete(k);
    // navigation preload: the browser asks the network for the page while this worker is still starting
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

// a page to show when offline and nothing is cached yet
const offline = () => new Response(
  '<!doctype html><html lang="zh-Hant-TW"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>吉諾機票研究所</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#FFFCF6;color:#3E3A39;font:17px/1.6 -apple-system,BlinkMacSystemFont,\'PingFang TC\',sans-serif;text-align:center;padding:24px">' +
  '<div style="border:3px solid #3E3A39;border-radius:22px;padding:18px 20px;max-width:320px;background:#FCF1D3"><p style="margin:0 0 8px">現在沒有網路。連上之後再打開一次。</p>' +
  '<p lang="en" style="margin:0;font-size:15px">You are offline. Open the site again once you are back online.</p></div></body></html>',
  { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

// a page load: the network first (the navigation preload, else a fetch); after SLOW_MS without an answer the kept
// copy, if there is one; offline, the kept copy at once; nothing kept yet, the network however long it takes
const SLOW_MS = 4000;
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.mode !== 'navigate' || req.method !== 'GET') return;   // not a page load: the browser fetches it as usual
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const keep = PAGE_PATHS.includes(url.pathname);
  let copy = null;
  const net = (async () => {
    const res = (await Promise.resolve(e.preloadResponse).catch(() => undefined)) || await fetch(req);
    // the newest good copy of the page itself (not a 404, a redirect, or some other page), cloned before it is read
    if (keep && res.ok && res.type === 'basic' && !res.redirected) copy = res.clone();
    return res;
  })();
  // a late answer refreshes the kept copy where the browser lets it finish (Chrome). WebKit drops the navigation
  // preload once the page was answered from the kept copy (its preloadResponse then never settles; seen 2026-10-15),
  // so there the next load that answers in time refreshes it; the 30 s cap lets this worker go idle meanwhile
  e.waitUntil(Promise.race([net.then(() => copy && caches.open(CACHE).then(c => c.put(PAGE, copy))), new Promise(r => setTimeout(r, 30000))]).catch(() => {}));
  const kept = () => caches.match(PAGE, { cacheName: CACHE }).catch(() => null);
  e.respondWith((async () => {
    let timer;
    const slow = new Promise(res => { timer = setTimeout(res, SLOW_MS, 'slow'); });
    try {
      const first = await Promise.race([net, slow]);
      if (first !== 'slow') return first;
      return (await kept()) || await net;   // nothing kept yet: keep waiting for the network
    } catch {
      return (await kept()) || offline();
    } finally { clearTimeout(timer); }
  })());
});

const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
// only this site's own pages; anything else opens the home page
function siteUrl(u) {
  if (typeof u !== 'string' || !u) return SCOPE;
  try {
    const x = new URL(u, SCOPE);
    return x.origin === self.location.origin ? x.href : SCOPE;
  } catch { return SCOPE; }
}

self.addEventListener('push', e => {
  let d = {};
  if (e.data) {
    try { d = e.data.json(); } catch { try { d = { body: e.data.text() }; } catch { d = {}; } }
  }
  if (!d || typeof d !== 'object') d = {};
  const tag = text(d.tag, 64);
  // acct: which account the push is for (a short tag of its email), so a tap can find that account's window
  const opts = { body: text(d.body, 400), icon: ICON, data: { url: siteUrl(d.url), acct: text(d.acct, 32) } };
  if (tag) { opts.tag = tag; opts.renotify = true; }   // a newer push for the same alert replaces the old one and still alerts
  // every push must show something (userVisibleOnly), so a payload we can't read still gets a plain notice
  e.waitUntil(self.registration.showNotification(text(d.title, 120) || '吉諾機票研究所', opts));
});

// which account a window is signed in to, as features/push.js answers it: the same tag the Worker sends as acct, or
// '' when signed out; null when it does not answer within ms (still loading, asleep in the background, an older page)
const WHO_MS = 300;
function whoIs(win, ms) {
  return new Promise(res => {
    const timer = setTimeout(res, ms, null);
    try {
      const ch = new MessageChannel();
      ch.port1.onmessage = m => { clearTimeout(timer); res(m.data && typeof m.data.acct === 'string' ? m.data.acct : null); };
      win.postMessage({ type: 'push-who' }, [ch.port2]);
    } catch { clearTimeout(timer); res(null); }
  });
}
// where an open window goes for url: on the same page (/ and /index.html are one, as in features/push.js) only the
// hash changes, so the window keeps its path and query and does not load again
function moveTo(at, url) {
  try {
    const w = new URL(at), u = new URL(url), page = p => p.replace(/index\.html$/, '');
    if (page(w.pathname) !== page(u.pathname)) return url;
    w.hash = u.hash || '#';   // the home page has no hash: an empty one still changes only the hash
    return w.href;
  } catch { return url; }
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {};
  const url = siteUrl(data.url);
  e.waitUntil((async () => {
    const wins = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(w => { try { return new URL(w.url).origin === self.location.origin; } catch { return false; } });
    // the most recently used window; with several (a computer, tabs signed in to different accounts) the one signed in
    // to the push's account, else a signed-out one (it opens the alert after sign-in), but only when the first window
    // said it is on another account (one that does not answer is kept, as before: it may be on the push's account).
    // All are asked at once and briefly: Firefox allows focus() for only about a second after the tap
    let win = wins[0];
    if (data.acct && wins.length > 1) {
      const who = await Promise.all(wins.map(w => whoIs(w, WHO_MS)));
      win = wins[who.indexOf(data.acct)] || (who[0] === null ? null : wins[who.indexOf('')]) || win;
    }
    if (win) {
      try { await win.focus(); } catch {}
      // this worker moves the window itself: one still loading does not hear the message yet (features/push.js
      // listens from 'load'). A window it does not control refuses navigate(); that one, and one already at the url
      // (the page then opens the alert again), get the message
      const to = moveTo(win.url, url);
      if (to !== win.url && 'navigate' in win) { try { await win.navigate(to); return; } catch {} }
      win.postMessage({ type: 'push-open', url });
      return;
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
