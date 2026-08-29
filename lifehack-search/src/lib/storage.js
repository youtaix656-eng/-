// 保存 — 端末内（localStorage）だけ。**このファイルはネットワークに触れない**（不変条件）。
// 将来クラウド同期を足す場合も、この層の外側に別のモジュールとして足すこと。

const KEY = 'lifehack-search:v1';

export const EMPTY = {
  favorites: [],   // 気になる（id の配列。押した順）
  tried: {},       // 試した記録 { [id]: { status, at, memo } }
  history: [],     // 検索の履歴（新しい順・上限あり）
  settings: { showBasis: true, effortMax: 3 },
  lastSeenAt: 0,
};

export const HISTORY_LIMIT = 20;

/** localStorage が使えない環境（プライベートモード等）でも落ちないための代替 */
let memory = null;

function readRaw() {
  try {
    return globalThis.localStorage ? globalThis.localStorage.getItem(KEY) : memory;
  } catch {
    return memory;
  }
}

function writeRaw(text) {
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(KEY, text);
    else memory = text;
  } catch {
    memory = text;
  }
}

export function load() {
  const raw = readRaw();
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw);
    return normalize(parsed);
  } catch {
    return { ...EMPTY };
  }
}

/** 形をそろえる（古い保存・壊れた保存でも落ちないように） */
export function normalize(state = {}) {
  return {
    ...EMPTY,
    ...state,
    favorites: Array.isArray(state.favorites) ? state.favorites.filter((x) => typeof x === 'string') : [],
    tried: state.tried && typeof state.tried === 'object' ? state.tried : {},
    history: Array.isArray(state.history) ? state.history.slice(0, HISTORY_LIMIT) : [],
    settings: { ...EMPTY.settings, ...(state.settings || {}) },
  };
}

export function save(state) {
  try {
    writeRaw(JSON.stringify(normalize(state)));
    return true;
  } catch {
    return false;
  }
}

export function clear() {
  try {
    if (globalThis.localStorage) globalThis.localStorage.removeItem(KEY);
    memory = null;
  } catch {
    memory = null;
  }
}

/** 設定画面の「保存されている量」表示用（バイト） */
export function storageSize() {
  const raw = readRaw();
  return raw ? new TextEncoder().encode(raw).length : 0;
}

/**
 * 検索の履歴に1件足す（同じ語は上へ寄せ、重ねない）。
 * **押した語をそのまま持つ**（正規化して持つと、履歴から入れ直した時に入力が変わってしまう）。
 */
export function pushHistory(history = [], query = '') {
  const text = String(query).trim();
  if (!text) return history;
  const rest = history.filter((h) => h.q !== text);
  return [{ q: text, at: Date.now() }, ...rest].slice(0, HISTORY_LIMIT);
}
