// タイムアタックの解答時間ログ（G-100「即答5秒達成率」を実測するため）。
//   一問一答の「ミニタイムアタックモード」で解答した時だけ記録する（制限時間を意識して
//   解いている場面に限定するため。通常の一問一答は集中していない解答も混ざるので対象外）。
//   端末内のみ・直近500件だけ保持する（roundLog.jsと同じ考え方）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:timeAttackLog';
const MAX_ENTRIES = 500;
export const QUICK_THRESHOLD_MS = 5000;

export async function loadTimeAttackLog() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

// questionId: 問題ID、ms: 実際の解答所要時間（ミリ秒）、correct: 正誤、
// limitSec: その時選んでいた制限時間（5/10/15/20。参考値として残す）
export async function appendTimeAttackEntry({ questionId, ms, correct, limitSec, at = Date.now() }) {
  const log = await loadTimeAttackLog();
  const next = [...log, { questionId, ms, correct, limitSec, at }].slice(-MAX_ENTRIES);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 「5秒以内に正しく即答できた」割合（選んだ制限時間に関わらず、実際の解答msで判定する）。
// 記録が無ければnull（0件を0%と断定しない）。
export function quickAnswerRate(log, thresholdMs = QUICK_THRESHOLD_MS) {
  if (!log || log.length === 0) return null;
  const quick = log.filter((e) => e.correct && e.ms <= thresholdMs).length;
  return quick / log.length;
}
