// 「できなかった日は、原因を分解する」— 連続日数が前日で途切れた時に、
//   責めるのではなく理由をワンタップで記録し、また今日から戻れるようにする。
//   端末内のみ（外部送信なし）。集計・分析はまだ行わない（記録して振り返れる状態を作るだけ）。

import { idbGet, idbSet } from './db.js';

const LOG_KEY = 'shinkyu:streakBreakLog'; // { [dayKey]: { reason, at } } — 原因を記録した日
const DISMISS_KEY = 'shinkyu:streakBreakDismissed'; // { [dayKey]: true } — 「あとで」で消した日
const DAY_MS = 24 * 60 * 60 * 1000;

export const BREAK_REASONS = [
  { id: 'notime', label: '時間がなかった' },
  { id: 'motivation', label: 'やる気が出なかった' },
  { id: 'forgot', label: '忘れていた' },
  { id: 'tired', label: '疲れていた' },
];

export function breakReasonLabel(id) {
  return BREAK_REASONS.find((r) => r.id === id)?.label || '';
}

function dayStart(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// 「きのう」だけ記録が無く、その前日には記録がある＝直前で連続が途切れた状態を検知する。
// 戻り値：途切れた日（きのう）の day キー。途切れていなければ null。
export function detectBrokenYesterday(history) {
  if (!history || !history.length) return null;
  const days = new Set();
  for (const h of history) { if (h.at) days.add(dayStart(h.at)); }
  const today = dayStart(Date.now());
  const yesterday = today - DAY_MS;
  const dayBefore = yesterday - DAY_MS;
  if (!days.has(yesterday) && days.has(dayBefore)) return yesterday;
  return null;
}

export async function loadStreakBreakLog() {
  try { return (await idbGet(LOG_KEY)) || {}; } catch (e) { return {}; }
}

export async function recordStreakBreakReason(dayKey, reasonId) {
  const log = await loadStreakBreakLog();
  log[dayKey] = { reason: reasonId, at: Date.now() };
  try { await idbSet(LOG_KEY, log); } catch (e) { /* noop */ }
  return log;
}

export async function loadStreakBreakDismissed() {
  try { return (await idbGet(DISMISS_KEY)) || {}; } catch (e) { return {}; }
}

export async function dismissStreakBreak(dayKey) {
  const d = await loadStreakBreakDismissed();
  d[dayKey] = true;
  try { await idbSet(DISMISS_KEY, d); } catch (e) { /* noop */ }
  return d;
}
