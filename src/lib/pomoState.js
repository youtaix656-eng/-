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
// 書き込みは1秒間隔で何度も起きるため、1回失敗しても次の呼び出しで自然に上書きされる。
// ただし「保存直後にタブが閉じられた」ようなタイミングだと次の機会が来ないので、
// 一度だけ短い間隔を空けて再試行する（端末のストレージが一時的に混み合っている場合の保険）。
export async function savePomoState(state) {
  try {
    await idbSet(KEY, state);
  } catch (e) {
    await new Promise((r) => setTimeout(r, 200));
    try { await idbSet(KEY, state); } catch (e2) { /* それでも失敗したら諦める（次回の呼び出しに委ねる） */ }
  }
}

export async function clearPomoState() {
  try { await idbDelete(KEY); } catch (e) { /* noop */ }
}
