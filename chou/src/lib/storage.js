// 保存は端末内（localStorage）だけ。
//
// **このファイルはネットワークに触れない。** これを不変条件とする
// （test/offline.test.mjs が `fetch` 等の不在を機械チェックする）。
// お通じと食事の記録は、健康の記録の中でもとりわけ人に見られたくないもの。
// 同期を足したくなっても、この層の外に別のモジュールとして置くこと。

const KEY = 'chou:v1';

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
    return true;
  } catch {
    // 書けなかったことを黙って飲み込まない（鏡で実際に踏んだ）。
    // 呼び出し側が「保存できていない」と画面に出せるよう false を返す。
    memory = text;
    return false;
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
    return writeRaw(JSON.stringify(state));
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

/** 設定画面の「保存されているもの」表示用 */
export function storageSize() {
  const raw = readRaw();
  if (!raw) return 0;
  try {
    return new Blob([raw]).size;
  } catch {
    return raw.length;
  }
}
