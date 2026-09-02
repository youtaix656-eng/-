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

self.addEventListener('install', () => {
  self.skipWaiting();
});

// ---- ポモドーロの「アプリを閉じても」対策のうち、唯一Web技術で試せる
// ベストエフォート機能（Periodic Background Sync）。
// 対応はChrome/Android系のみ・PWAインストール必須・呼ばれる間隔もブラウザの
// 裁量（多くの場合、半日〜1日おき程度まで間引かれる）で保証が無いため、
// 「勉強タイマーの通知」としての精度は粗い。失敗・未対応時は静かに諦める。
const POMO_DB = 'shinkyu-db';
const POMO_STORE = 'kv';
const POMO_STATE_KEY = 'shinkyu:pomoState';

function openPomoDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(POMO_DB, 1);
    // 本体側（src/lib/db.js）と同じ形でストアを作る。SWがページより先に開いても、
    // ページが開くのが先でも、どちらの順でも 'kv' ストアが必ず存在するようにする
    // （片方だけがonupgradeneededを持たないと、ストア無しでバージョンが確定してしまい
    // 以後ずっと作れなくなる恐れがあるため）。
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(POMO_STORE)) db.createObjectStore(POMO_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function checkPomoStateAndNotify() {
  try {
    const db = await openPomoDB();
    if (!db.objectStoreNames.contains(POMO_STORE)) { db.close(); return; }
    const state = await new Promise((resolve, reject) => {
      const tx = db.transaction(POMO_STORE, 'readonly');
      const req = tx.objectStore(POMO_STORE).get(POMO_STATE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (state && state.running && state.phaseEndAt && Date.now() >= state.phaseEndAt) {
      await self.registration.showNotification('ポモドーロ', {
        body: '設定した時間が過ぎています。アプリを開いて確認してください。',
        tag: 'pomodoro-periodic-check',
      });
    }
  } catch (e) {
    // ベストエフォート機能のため、失敗しても本体に影響させない
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'pomodoro-periodic-check') {
    event.waitUntil(checkPomoStateAndNotify());
  }
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
