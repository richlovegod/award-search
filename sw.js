// Service worker for 里程機位搜尋 (award.ginochang.com), 2026-10-15. Registered by features/push.js; scope '/'.
// 1. The installable web app: a page load goes to the network first (with navigation preload, so it does not wait
//    for this worker to start), and keeps the latest copy of the page; when the network fails (offline) or has not
//    answered in 4 seconds (a weak signal), that copy is shown. Nothing else is touched: the Worker's API is on
//    another origin and is never cached, and every other request goes to the network exactly as without a worker.
// 2. Push notifications for alerts: shows the Worker's { title, body, url, tag }; a tap brings the site's open
//    window forward and moves it to the alert (features/push.js hears the message), or opens a new window.
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
  '<title>里程機位搜尋</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#FFFCF6;color:#3E3A39;font:17px/1.6 -apple-system,BlinkMacSystemFont,\'PingFang TC\',sans-serif;text-align:center;padding:24px">' +
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
  const opts = { body: text(d.body, 400), icon: ICON, data: { url: siteUrl(d.url) } };
  if (tag) { opts.tag = tag; opts.renotify = true; }   // a newer push for the same alert replaces the old one and still alerts
  // every push must show something (userVisibleOnly), so a payload we can't read still gets a plain notice
  e.waitUntil(self.registration.showNotification(text(d.title, 120) || '機位搜尋', opts));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = siteUrl(e.notification.data && e.notification.data.url);
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find(w => { try { return new URL(w.url).origin === self.location.origin; } catch { return false; } });
    if (win) {
      try { await win.focus(); } catch {}
      win.postMessage({ type: 'push-open', url });
      return;
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
