// Service Worker — 「常に最新」を優先しつつオフラインでも起動できる方式
//
// 方針:
//  - ページ本体(HTML/ナビゲーション) は network-first。
//    → 開くたびに最新の index.html を取得するので、新しいデプロイが即反映される。
//    → オフライン時のみキャッシュした本体で起動する。
//  - ハッシュ付きアセット(JS/CSS/画像) は cache-first。
//    → ファイル名にハッシュが付くため、内容が変わればURLも変わる＝キャッシュしても安全。
//  - 新しい Service Worker は待たずに有効化（skipWaiting + clients.claim）。

// 同じGitHub Pages配下に他の同梱アプリ（るるくる・睡眠トラッカー・腰痛ナビ等）も
// 存在するため、将来それぞれが独自のService Workerを持った時にキャッシュ名が
// 衝突しないよう、アプリ名を含めた分かりやすい名前にしている。
const CACHE = 'shinkyu-exam-app-cache-v3';

// まだ一度もオンラインで開いたことが無い端末でオフラインになった時だけ表示する案内ページ
// （通常はここに来る前にキャッシュ済みのindex.htmlが返るため、ほとんどのユーザーは見ない）。
const OFFLINE_FALLBACK_HTML = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>オフラインです - 鍼灸国試 対策アプリ</title>
<style>
  body{margin:0;background:#000;color:#fff;font-family:-apple-system,'Hiragino Kaku Gothic ProN','Hiragino Sans','Noto Sans JP',sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;box-sizing:border-box;}
  .box{max-width:360px;text-align:center;}
  .ico{font-size:40px;margin-bottom:12px;}
  h1{font-size:17px;margin:0 0 10px;}
  p{font-size:13.5px;line-height:1.7;color:#ccc;margin:0 0 18px;}
  button{background:#fff;color:#000;border:none;border-radius:10px;padding:10px 20px;font-size:14px;font-weight:600;}
</style></head>
<body>
  <div class="box">
    <div class="ico">📡</div>
    <h1>オフラインです</h1>
    <p>電波の届く場所で一度アプリを開くと、以後はオフラインでも使えるようになります。</p>
    <button onclick="location.reload()">再読み込み</button>
  </div>
</body></html>`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 同じドメイン（GitHub Pages）に同梱の別アプリ（/ouro など）も CacheStorage を
      // 共有している。名前を見ずに消すと、そちらのキャッシュまで巻き添えで消える。
      // このアプリの分（shinkyu-）だけを対象にする。
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('shinkyu-') && k !== CACHE).map((k) => caches.delete(k))
      );
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
          // まだ一度もオンラインで開けておらずキャッシュが無い状態でオフラインになった場合のみ、
          // ここに到達する（初回訪問は必ずオンラインでの読み込みが必要）。プレーンテキストだと
          // 素っ気ないため、簡易な案内ページを返す。
          return new Response(OFFLINE_FALLBACK_HTML, {
            status: 503,
            statusText: 'offline',
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
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
