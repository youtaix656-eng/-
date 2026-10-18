// スケジュール（手入力）の扱い。カレンダーは別のデータを持たず、ここから毎回導く。

import { addDaysKey, isValidKey, isValidTime, startOfWeekKey, timeToMinutes, weekdayOf } from './date.js';
import type { DateKey, ExamDate, ScheduleEntry } from '../types/index.js';

/** その日にその予定があるか（繰り返しを展開する） */
export function occursOn(entry: ScheduleEntry, date: DateKey): boolean {
  if (date < entry.date) return false;
  switch (entry.repeat) {
    case 'none':
      return date === entry.date;
    case 'daily':
      return true;
    case 'weekly':
      return weekdayOf(entry.date) === weekdayOf(date);
    case 'weekdays': {
      const wd = weekdayOf(date);
      return wd >= 1 && wd <= 5;
    }
    default:
      return false;
  }
}

/** その日の予定（開始時刻順） */
export function entriesOn(entries: ScheduleEntry[], date: DateKey): ScheduleEntry[] {
  return entries.filter((e) => occursOn(e, date)).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/** 月のカレンダー用：予定のある日の集合 */
export function datesWithEntries(entries: ScheduleEntry[], year: number, month1: number): Set<DateKey> {
  const out = new Set<DateKey>();
  const last = new Date(year, month1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const key = `${year}-${String(month1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (entries.some((e) => occursOn(e, key))) out.add(key);
  }
  return out;
}

export interface WeekOccurrence {
  date: DateKey;
  entry: ScheduleEntry;
}

/** 今週（月〜日）に起きる予定を日付つきで並べる */
export function thisWeek(entries: ScheduleEntry[], today: DateKey): WeekOccurrence[] {
  const from = startOfWeekKey(today);
  const out: WeekOccurrence[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysKey(from, i);
    for (const entry of entriesOn(entries, date)) out.push({ date, entry });
  }
  return out;
}

export interface ValidationError {
  field: 'date' | 'startTime' | 'endTime';
  message: string;
}

/** 保存前の確認。通らなければ理由を返す（黙って直さない） */
export function validateEntry(input: Pick<ScheduleEntry, 'date' | 'startTime' | 'endTime'>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isValidKey(input.date)) errors.push({ field: 'date', message: '日付を入れてください' });
  if (!isValidTime(input.startTime)) errors.push({ field: 'startTime', message: '開始時刻を入れてください' });
  if (!isValidTime(input.endTime)) errors.push({ field: 'endTime', message: '終了時刻を入れてください' });
  if (errors.length === 0 && timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
    errors.push({ field: 'endTime', message: '終了は開始より後にしてください' });
  }
  return errors;
}

/** 試験日：近い順（過ぎたものは後ろ） */
export function sortExams(exams: ExamDate[], today: DateKey): ExamDate[] {
  const upcoming = exams.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = exams.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return [...upcoming, ...past];
}
