// 「😴 明日まで先送り」の明示的な記録（#27）。
//   setNextDue自体は誤答理由別の間隔調整（missTypes.js）でも呼ばれるため、
//   スヌーズ「ボタンを押した」という操作だけを別に記録し、
//   「先送りグセ」（同じ問題を繰り返し先送りしている）に気づけるようにする。
//   端末内のみ。件数の上限は持たず、手動でのみ消去する（missTypes.jsと同じ方針）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:snoozeLog';

export async function loadSnoozeLog() {
  try { return (await idbGet(KEY)) || {}; } catch (e) { return {}; }
}

export async function recordSnooze(questionId, now = Date.now()) {
  const log = await loadSnoozeLog();
  const list = log[questionId] || [];
  const next = { ...log, [questionId]: [...list, now] };
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

export function snoozeCount(log, questionId) {
  return (log?.[questionId] || []).length;
}

// 「先送りグセ」の目安（同じ問題を3回以上先送りしている）。
export const SNOOZE_HABIT_THRESHOLD = 3;
export function isSnoozeHabit(log, questionId) {
  return snoozeCount(log, questionId) >= SNOOZE_HABIT_THRESHOLD;
}
