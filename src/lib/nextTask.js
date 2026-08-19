// 「明日の最初の1タスク」— 学習セッション完了時に次にやることを1つだけ決めて保存する。
//   次回アプリを開いた時、ホーム画面の一番上に固定表示する。「何から始めるか」で迷う時間をゼロにするため。
//   端末内のみ（外部送信なし）。

import { idbGet, idbSet, idbDelete } from './db.js';

const KEY = 'shinkyu:nextTask';

export async function loadNextTask() {
  try { return (await idbGet(KEY)) || null; } catch (e) { return null; }
}

export async function saveNextTask(text) {
  const v = { text: String(text).trim(), at: Date.now() };
  try { await idbSet(KEY, v); } catch (e) { /* noop */ }
  return v;
}

export async function clearNextTask() {
  try { await idbDelete(KEY); } catch (e) { /* noop */ }
}
