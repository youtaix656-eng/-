// データ保存方針 — 企画書 改善策 #5
//
// 保存先は端末内（localStorage）のみ。外部送信・クラウド同期は行わない。
// クラウド同期を将来追加する場合も、この層の外側に別モジュールとして足す
// （このファイルがネットワークに触れないことを不変条件とする）。

const KEY = 'youtsu-navi:v1';

/** localStorage が使えない環境（プライベートモード等）でも落ちないための代替 */
let memory = null;

function readRaw() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

function writeRaw(text) {
  try {
    window.localStorage.setItem(KEY, text);
  } catch {
    memory = text;
  }
}

export function load(fallback) {
  const raw = readRaw();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function save(state) {
  try {
    writeRaw(JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clear() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    memory = null;
  }
}

/** 設定画面の「保存されているデータ」表示用 */
export function storageSize() {
  const raw = readRaw();
  return raw ? new Blob([raw]).size : 0;
}
