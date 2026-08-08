// Service Worker — 「常に最新」を優先しつつオフラインでも起動できる方式
//
// 方針:
//  - ページ本体(HTML/ナビゲーション) は network-first。
//  - ハッシュ付きアセット(JS/CSS/画像) は cache-first。
//  - 新しい Service Worker は待たずに有効化（skipWaiting + clients.claim）。

const CACHE = 'sleep-tracker-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isNavigation(req) {
  return (
    req.mode === 'navigate' ||
    (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'))
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigation(req)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = (await cache.match(req)) || (await cache.match('./')) ||
            (await cache.match('index.html'));
          if (cached) return cached;
          return new Response('オフラインです', { status: 503, statusText: 'offline' });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.status === 200 && res.type === 'basic') {
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        return new Response('', { status: 504 });
      }
    })()
  );
});
