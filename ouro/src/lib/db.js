// IndexedDB の薄いラッパ（1ストアの key-value）。
// 依存を増やさないため自前。使えない環境では isIdbSupported() が false を返す。

const DB_NAME = 'ouro';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise = null;

export function isIdbSupported() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// fn(store) が返した IDBRequest の result をトランザクション完了後に返す。
// 注意：値が未保存のとき req.result は undefined になる。ここで
// 「undefined なら req 自体を返す」ようにすると、呼び出し側に IDBRequest が
// 漏れて .filter is not a function で画面が真っ白になる（実際に一度やった）。
// 必ず req.result を返し、未保存は undefined のままにすること。
function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let req;
        try {
          req = fn(store);
        } catch (e) {
          reject(e);
          return;
        }
        t.oncomplete = () => resolve(req && typeof req === 'object' && 'result' in req ? req.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export function idbGet(key) {
  return tx('readonly', (store) => store.get(key));
}

export function idbSet(key, value) {
  return tx('readwrite', (store) => store.put(value, key));
}

export function idbDelete(key) {
  return tx('readwrite', (store) => store.delete(key));
}

/**
 * 複数のキーを **1回のトランザクション** でまとめて読む。
 * 起動時にキーごとに開くと、その回数だけ往復が増えて起動が遅くなる。
 * @returns {Promise<Map<string, any>>} 未保存のキーは Map に入らない
 */
export function idbGetMany(keys = []) {
  if (!keys.length) return Promise.resolve(new Map());
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readonly');
        const store = t.objectStore(STORE);
        const out = new Map();
        for (const key of keys) {
          const req = store.get(key);
          req.onsuccess = () => {
            if (req.result !== undefined) out.set(key, req.result);
          };
        }
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

/** 複数の書き込み・削除を1回のトランザクションでまとめて行う。 */
export function idbWriteMany(entries = [], deleteKeys = []) {
  if (!entries.length && !deleteKeys.length) return Promise.resolve();
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite');
        const store = t.objectStore(STORE);
        for (const [key, value] of entries) store.put(value, key);
        for (const key of deleteKeys) store.delete(key);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

/**
 * 接頭辞で始まるキーをまとめて読む（1件ずつ保存したレコードの読み出しに使う）。
 * @returns {Promise<Map<string, any>>}
 */
export function idbGetPrefix(prefix) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readonly');
        const store = t.objectStore(STORE);
        const out = new Map();
        // prefix 〜 prefix+末尾文字 の範囲を走査する
        const range = IDBKeyRange.bound(prefix, `${prefix}￿`, false, false);
        const req = store.openCursor(range);
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) return;
          out.set(String(cur.key), cur.value);
          cur.continue();
        };
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

/**
 * 同じ頭文字のレコードを、**新しい方から** limit 件だけ読む（新項目09）。
 * 操作履歴のようにキー自体が時刻順のものにだけ使う。
 * 戻り値は昇順（古い→新しい）に整えた Map。
 */
export function idbGetPrefixLast(prefix, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return idbGetPrefix(prefix);
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, 'readonly');
        const store = t.objectStore(STORE);
        const picked = [];
        const range = IDBKeyRange.bound(prefix, `${prefix}￿`, false, false);
        // 'prev' ＝ 新しい方から。limit 件そろったらそこで打ち切る。
        const req = store.openCursor(range, 'prev');
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) return;
          picked.push([String(cur.key), cur.value]);
          if (picked.length >= limit) return; // continue しない＝ここで走査を終える
          cur.continue();
        };
        t.oncomplete = () => resolve(new Map(picked.reverse()));
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}
