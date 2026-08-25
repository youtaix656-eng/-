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
