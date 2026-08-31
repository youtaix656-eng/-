// ポモドーロの勉強時間ログ（今日・今週の合計時間、完了回数を出すための記録）。
// 端末内のみ・直近500件だけ保持する。studyフェーズを完走した時にだけ1件追加する
// （休憩は数えない）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:pomoLog';
const MAX_ENTRIES = 500;

export async function loadPomoLog() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

// entry: { studySec, at, label? }　label は「今回の勉強内容」の任意メモ
export async function appendPomoLog(entry) {
  const log = await loadPomoLog();
  const next = [...log, entry].slice(-MAX_ENTRIES);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

export function todayStart(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function weekStart(now = Date.now()) {
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function totalStudySecSince(log, sinceMs) {
  return (log || []).filter((e) => e.at >= sinceMs).reduce((s, e) => s + (e.studySec || 0), 0);
}

export function countSince(log, sinceMs) {
  return (log || []).filter((e) => e.at >= sinceMs).length;
}
