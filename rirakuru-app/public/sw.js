// ============================================================
// Service Worker（PWA オフライン対応）
// ネットワーク優先＋失敗時はキャッシュにフォールバックする戦略。
// 一度開いたページ・アセットはキャッシュされ、オフラインでも閲覧できる。
// ============================================================
const CACHE = "rirakuru-manual-v1";

// インストール時にすぐ有効化
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// 古いキャッシュを掃除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// GET リクエストのみ処理（ネットワーク優先→キャッシュ）
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 正常なレスポンスは複製してキャッシュに保存
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // ページ遷移でキャッシュが無ければアプリのトップにフォールバック。
          // サブパス配信でも動くよう SW のスコープ（配信位置）を基準にする。
          if (request.mode === "navigate") {
            const root = new URL(self.registration.scope).pathname;
            return caches.match(root);
          }
          return new Response("", { status: 504, statusText: "offline" });
        })
      )
  );
});
