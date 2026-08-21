// Service Worker — オフラインでも起動でき、更新も取りこぼさない方式。
//  - ページ本体（ナビゲーション）は network-first（更新を確実に拾う）
//  - ハッシュ付きアセットは cache-first（オフラインで即起動）
//  - 別オリジン（Google Fonts など）はキャッシュしない。読めない時はフォールバック書体で出る

const CACHE = 'henkaku-note-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isNavigation(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));
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
        } catch {
          const cached = (await cache.match(req)) || (await cache.match('./')) || (await cache.match('index.html'));
          return cached || new Response('オフラインです', { status: 503 });
        }
      })(),
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
        if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
        return res;
      } catch {
        return new Response('', { status: 504 });
      }
    })(),
  );
});
