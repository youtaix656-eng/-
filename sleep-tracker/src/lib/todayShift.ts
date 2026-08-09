import type { CaffeineIntake, ShiftLog, SymptomEntry, VentilationStatus } from '../types/work';
import type { SleepRecord } from '../types/sleep';
import { newId } from './id';
import { todayISODate } from './time';

function blankShift(date: string, now: string): ShiftLog {
  return {
    id: newId(),
    date,
    startTime: '',
    ventilation: 'unknown',
    priorSleepAuto: true,
    caffeine: { taken: false },
    symptoms: [],
    memo: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function findTodayShift(shifts: ShiftLog[]): ShiftLog | undefined {
  return shifts.find((s) => s.date === todayISODate());
}

// 直近の睡眠記録から「前夜の睡眠」を推定する（このアプリの睡眠記録と自動で紐づける）。
export function derivePriorSleepFromRecords(records: SleepRecord[]): {
  hours?: number;
  pattern?: { start: string; end: string };
} {
  const latest = records[0];
  if (!latest || !latest.coreSleep.start) return {};
  return { hours: latest.totalSleepHours, pattern: { start: latest.coreSleep.start, end: latest.coreSleep.end } };
}

// 勤務開始時の入力を今日のシフトに反映する（症状ログが先に付いていれば保持する）。
export function applyShiftStart(
  shifts: ShiftLog[],
  input: {
    startTime: string;
    ventilation: VentilationStatus;
    priorSleepHours?: number;
    priorSleepAuto: boolean;
    priorSleepPattern?: { start: string; end: string };
    caffeine: CaffeineIntake;
  }
): ShiftLog {
  const today = todayISODate();
  const now = new Date().toISOString();
  const existing = findTodayShift(shifts) ?? blankShift(today, now);
  return {
    ...existing,
    startTime: input.startTime,
    ventilation: input.ventilation,
    priorSleepHours: input.priorSleepHours,
    priorSleepAuto: input.priorSleepAuto,
    priorSleepPattern: input.priorSleepPattern,
    caffeine: input.caffeine,
    updatedAt: now,
  };
}

// 症状ログを今日のシフトに追記する。勤務開始が未入力でも記録を止めない
// （施術中はまず記録を優先し、開始情報は後から埋められるようにする）。
export function attachSymptomToTodayShift(shifts: ShiftLog[], symptom: SymptomEntry): ShiftLog {
  const today = todayISODate();
  const now = new Date().toISOString();
  const existing = findTodayShift(shifts) ?? blankShift(today, now);
  return {
    ...existing,
    symptoms: [...existing.symptoms, symptom],
    updatedAt: now,
  };
}
