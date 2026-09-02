// ポモドーロの実行中状態（フェーズ・終了予定時刻・完了回数）を端末内に保存する。
// これが無いと、ページ再読み込みやアプリの再起動のたびにタイマーが振り出しに戻っていた。
// バックアップ（QR・Googleドライブ等）の対象には含めない
// （missTypes.js・starWeak.js・roundLog.jsと同じ、端末だけの一時状態という扱い）。
//
// IndexedDB優先・localStorageフォールバック（storage.jsと同じ考え方）。
// IndexedDBが使えない/一時的に壊れている端末でも、直近のタイマー状態だけは残るようにする。

import { idbGet, idbSet, idbDelete, isIdbSupported } from './db.js';

const KEY = 'shinkyu:pomoState';
const UI_KEY = 'shinkyu:pomoUi';
const useIdb = isIdbSupported();

/**
 * 保存済みの実行中状態を読む。
 * 「何も保存していない」（初回利用等）は null を返す。
 * IndexedDB・localStorageの両方が読み取りに失敗した場合だけ例外を投げる
 * （呼び出し側はこれを「復元できなかった異常」として扱い、ユーザーに知らせられる）。
 */
export async function loadPomoState() {
  try {
    if (useIdb) {
      const v = await idbGet(KEY);
      if (v !== undefined) return v || null;
    }
  } catch (e) {
    // 下のlocalStorageで試す
  }
  try {
    const raw = localStorage.getItem(KEY);
    return raw == null ? null : JSON.parse(raw);
  } catch (e) {
    throw new Error('pomoState の復元に失敗しました');
  }
}

async function writeOnce(key, value) {
  try {
    if (useIdb) { await idbSet(key, value); return true; }
  } catch (e) {
    // 下のlocalStorageで試す
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

// state: { phase, running, remaining, phaseEndAt, done }
// 1回失敗しても、少し間を空けてもう一度だけ試す（端末のストレージが一時的に
// 混み合っている場合の保険）。それでも失敗したらfalseを返し、呼び出し側が
// 次のtickで再試行するかどうかを判断する。
export async function savePomoState(state) {
  if (await writeOnce(KEY, state)) return true;
  await new Promise((r) => setTimeout(r, 200));
  return writeOnce(KEY, state);
}

export async function clearPomoState() {
  try { if (useIdb) await idbDelete(KEY); } catch (e) { /* noop */ }
  try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
}

// ---- 表示だけの一時状態（最小化/展開・設定パネル開閉・入力中のタグ等） ----
// 複数タブでの共有やフェーズ計算とは無関係な「見た目」だけの情報なので、
// 上のphase/phaseEndAt等とは別キーに持つ（幹事タブ判定の対象にもしない）。
// SW更新等で予期せずページが再読み込みされても、開いていた表示状態がいきなり
// 畳まれたり入力中の文字が消えたりすると「リセットされた」と感じやすいため復元する。
export async function loadPomoUi() {
  try {
    if (useIdb) {
      const v = await idbGet(UI_KEY);
      if (v !== undefined) return v || null;
    }
  } catch (e) { /* 下のlocalStorageで試す */ }
  try {
    const raw = localStorage.getItem(UI_KEY);
    return raw == null ? null : JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export async function savePomoUi(ui) {
  await writeOnce(UI_KEY, ui);
}
