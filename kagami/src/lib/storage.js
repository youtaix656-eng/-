// 保存は端末内（localStorage）だけ。
//
// **このファイルはネットワークに触れない。** これを不変条件とする。
// 将来クラウド同期を足すとしても、この層の外に別モジュールとして置くこと
// （ここに fetch が1つ入った時点で「貼った文面は端末から出ない」が嘘になる）。

const KEY = 'kagami:v1';

/** localStorage が使えない環境（プライベートモード等）でも落ちないための代替 */
let memory = null;

function readRaw() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

/**
 * @returns {boolean} 端末に書けたか。
 * **書けなかったことを飲み込まない**——ここで黙って手元の変数へ逃がしていたので、
 * `save()` は常に true を返し、画面は「保存しました」と出したまま何も残らず、
 * 再読み込みで全部消えていた（実際に踏んだ）。
 */
function writeRaw(text) {
  try {
    window.localStorage.setItem(KEY, text);
    memory = null;
    return true;
  } catch {
    memory = text; // 開いている間だけは読み直せるようにしておく
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

/** @returns {boolean} 端末に残せたか（false なら画面が知らせる） */
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

/** 設定画面の「保存されているデータ」表示用 */
export function storageSize() {
  const raw = readRaw();
  return raw ? new Blob([raw]).size : 0;
}
