// 音声学習×連結学習の#43「次のセットまでの小休止」で「1分後／5分後に自動再開」を選んだ時の
// 見張り役（単一の発生源）。自動再開（setTimeoutのコールバック、非ジェスチャー文脈からの
// speechSynthesis呼び出し）はブラウザによっては音が出ないまま静かに失敗する可能性がある
// （2026-11-12に修正したstale-closureのバグと同じ種類のリスク）ため、黙って済ませず、
// タイマーが実際に発火する前にアプリが閉じられた／再読み込みされた場合は、次に開いた時に
// 一言添える。タイマーが正常に発火したら必ずclearする。
import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:audioBreakResumePending';

export async function setBreakResumePending(delayMin) {
  try { await idbSet(KEY, { at: Date.now(), delayMin }); } catch (e) { /* noop */ }
}

export async function clearBreakResumePending() {
  try { await idbSet(KEY, null); } catch (e) { /* noop */ }
}

export async function loadBreakResumePending() {
  try { return (await idbGet(KEY)) || null; } catch (e) { return null; }
}
