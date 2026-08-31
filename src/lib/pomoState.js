// ポモドーロの実行中状態（フェーズ・終了予定時刻・完了回数）を端末内に保存する。
// これが無いと、ページ再読み込みやアプリの再起動のたびにタイマーが振り出しに戻っていた。
// バックアップ（QR・Googleドライブ等）の対象には含めない
// （missTypes.js・starWeak.js・roundLog.jsと同じ、端末だけの一時状態という扱い）。

import { idbGet, idbSet, idbDelete } from './db.js';

const KEY = 'shinkyu:pomoState';

export async function loadPomoState() {
  try { return (await idbGet(KEY)) || null; } catch (e) { return null; }
}

// state: { phase, running, remaining, phaseEndAt, done }
export async function savePomoState(state) {
  try { await idbSet(KEY, state); } catch (e) { /* noop */ }
}

export async function clearPomoState() {
  try { await idbDelete(KEY); } catch (e) { /* noop */ }
}
