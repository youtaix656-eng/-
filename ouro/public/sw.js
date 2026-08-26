// Ouro の Service Worker（項目09）。
//
// 方針：
//   - JS/CSS は中身が変わるとファイル名も変わる（ハッシュ付き）ので、
//     一度取ったらキャッシュから即返してよい＝2回目以降の起動が速い。
//   - HTML は毎回ネットワークを先に見る。ここをキャッシュすると
//     デプロイしても古いアプリが出続けてしまう。
//   - 画像・フォントはキャッシュ優先。
// オフラインでも、一度開いていれば起動する。

const VERSION = 'ouro-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      // 同じドメインに同梱された別アプリ（鍼灸アプリ等）と CacheStorage を共有している。
      // 名前を見ずに消すと、そちらのキャッシュまで巻き添えで消えるので、
      // 「ouro-」で始まる自分の分の、古い版だけを消す。
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith('ouro-') && !n.startsWith(VERSION))
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外部（AIのAPI等）には触らない

  // 画面そのもの（HTML）＝ネットワーク優先。落ちたらキャッシュ。
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // ハッシュ付きの資材・画像・フォント＝キャッシュ優先
  if (/\/assets\/|\.(js|css|png|jpg|jpeg|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
