// Service Worker（提案27・追加依頼3）。
//
// 方針は鍼灸アプリの `public/sw.js` と同じ考え方：
//  - ページ本体（ナビゲーション）は **network-first**。開くたびに最新を取りに行き、
//    オフラインの時だけキャッシュした本体で起動する。
//  - ハッシュの付いたアセット（JS/CSS）は **cache-first**（名前が変われば URL も変わる）。
//  - 新しい Service Worker は待たずに有効化する。
//
// このアプリの決まりとの関係
//  - **送る仕組みではない。** ここが触るのは自分自身の配信ファイルだけで、
//    記録（localStorage）には一切さわらない・どこへも送らない。
//  - **通知を出さない**（押し通知も、裏で定期的に動く仕掛けも持たない。README 決まり6）。

const CACHE = 'chou-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('chou-') && k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isAsset(url) {
  return /\.(js|mjs|css|woff2?|svg|png|webmanifest)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 自分の配信元だけを扱う（ほかのアプリ・外のサイトには触らない）
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const hit = await cache.match(req);
          if (hit) return hit;
          const index = await cache.match('./index.html');
          if (index) return index;
          throw new Error('offline');
        }
      })(),
    );
    return;
  }

  if (!isAsset(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })(),
  );
});
