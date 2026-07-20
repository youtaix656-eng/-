// Service Worker — 「常に最新」を優先しつつオフラインでも起動できる方式
//
// 方針:
//  - ページ本体(HTML/ナビゲーション) は network-first。
//    → 開くたびに最新の index.html を取得するので、新しいデプロイが即反映される。
//    → オフライン時のみキャッシュした本体で起動する。
//  - ハッシュ付きアセット(JS/CSS/画像) は cache-first。
//    → ファイル名にハッシュが付くため、内容が変わればURLも変わる＝キャッシュしても安全。
//  - 新しい Service Worker は待たずに有効化（skipWaiting + clients.claim）。

const CACHE = 'shinkyu-cache-v2';

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

  // ページ本体は network-first（常に最新を取りにいく）
  if (isNavigation(req)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          // オフライン時はキャッシュにフォールバック
          const cached = (await cache.match(req)) || (await cache.match('./')) ||
            (await cache.match('index.html'));
          if (cached) return cached;
          return new Response('オフラインです', { status: 503, statusText: 'offline' });
        }
      })()
    );
    return;
  }

  // それ以外（ハッシュ付きアセット等）は cache-first
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
