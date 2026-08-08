import type { SleepRecord } from '../types/sleep';
import { todayISODate } from './time';

function hasAnyData(r: SleepRecord): boolean {
  return Boolean(r.coreSleep.start) || r.naps.length > 0;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 連続記録日数。今日はまだ未入力でも、そこで連続が途切れたとは見なさない
// （寝る前・起きた直後などまだ記録していないだけのことが多いため）。
export function computeStreak(records: SleepRecord[]): number {
  const dates = new Set(records.filter(hasAnyData).map((r) => r.date));
  const today = todayISODate();
  const cursor = new Date(`${today}T00:00:00`);
  if (!dates.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (dates.has(isoOf(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
