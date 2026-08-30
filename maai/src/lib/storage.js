// 保存は端末内（localStorage）だけ。
//
// **このファイルはネットワークに触れない。** これを不変条件とする。
// 将来クラウド同期を足すとしても、この層の外に別モジュールとして置くこと
// （ここに fetch が1つ入った時点で「貼った文面は端末から出ない」が嘘になる）。

const KEY = 'maai:v1';

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
