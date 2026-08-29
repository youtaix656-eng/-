// 保存先は端末内だけ。**このファイルはネットワークに触れない**（不変条件）。
//
// 資格ラボが持つのは「あなたが受ける試験・答えた自己申告・作った問題・書いた計画」。
// どれも外へ出す理由が無いので、外へ出す口を最初から作らない。
// 将来クラウド同期を足す時も、この層の外側に別モジュールとして足すこと。

const KEY = 'shikaku-lab:v1';

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
    // settings は既定値を土台にする（項目を足した時に undefined にしないため）
    return {
      ...fallback,
      ...parsed,
      settings: { ...fallback.settings, ...(parsed.settings || {}) },
      pomodoro: { ...fallback.pomodoro, ...(parsed.pomodoro || {}) },
    };
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
