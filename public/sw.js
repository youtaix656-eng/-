// Service Worker — オフライン起動とアプリシェルのキャッシュ
//
// アセット名はビルド時にハッシュ化されるため、事前リストではなく
// 「取得したものを順次キャッシュする」stale-while-revalidate 方式を採る。
// これにより一度オンラインで開けば、以降はオフラインでも起動できる。

const CACHE = 'shinkyu-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 旧バージョンのキャッシュを削除
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // GET かつ同一オリジンのみ対象（CDN や外部OCRモデル等はキャッシュしない）
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);

      // キャッシュ優先。無ければネットワーク。両方だめなら index にフォールバック。
      if (cached) {
        network; // バックグラウンドで更新
        return cached;
      }
      const res = await network;
      if (res) return res;
      // ナビゲーション要求はアプリシェル(index)を返す
      if (req.mode === 'navigate') {
        const shell = await cache.match('./') || await cache.match('index.html');
        if (shell) return shell;
      }
      return new Response('オフラインです', { status: 503, statusText: 'offline' });
    })()
  );
});
