// 今日の調子（元気／普通／しんどい）をワンタップ記録。
//   ハリオ先生の一言や「今日の進捗」のノルマ調整に使う。端末内のみ（外部送信なし）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:moodLog'; // { [dayKey]: { mood, at } }

export const MOODS = [
  { id: 'good', label: '元気', emoji: '😄' },
  { id: 'normal', label: '普通', emoji: '🙂' },
  { id: 'tired', label: 'しんどい', emoji: '😪' },
];

export function moodDayKey(ms = Date.now()) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return String(d.getTime());
}

export async function loadMoodLog() {
  try { return (await idbGet(KEY)) || {}; } catch (e) { return {}; }
}

export async function recordTodayMood(moodId) {
  const log = await loadMoodLog();
  log[moodDayKey()] = { mood: moodId, at: Date.now() };
  try { await idbSet(KEY, log); } catch (e) { /* noop */ }
  return log;
}

export async function loadTodayMood() {
  const log = await loadMoodLog();
  return log[moodDayKey()]?.mood || null;
}
