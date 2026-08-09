import type { CaffeineIntake, ShiftLog, SymptomEntry, TreatmentSession, VentilationStatus } from '../types/work';
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
    sessions: [],
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
    tookBreaks?: boolean;
    continuousTreatmentHours?: number;
  }
): ShiftLog {
  const today = todayISODate();
  const now = new Date().toISOString();
  const existing = findTodayShift(shifts) ?? blankShift(today, now);
  return {
    ...existing,
    dayOff: false,
    startTime: input.startTime,
    ventilation: input.ventilation,
    priorSleepHours: input.priorSleepHours,
    priorSleepAuto: input.priorSleepAuto,
    priorSleepPattern: input.priorSleepPattern,
    caffeine: input.caffeine,
    tookBreaks: input.tookBreaks,
    continuousTreatmentHours: input.continuousTreatmentHours,
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

// 症状に対処法を追記する（記録直後のチェーン入力用）。
export function attachCopingToSymptom(
  shift: ShiftLog,
  symptomId: string,
  coping: NonNullable<SymptomEntry['coping']>
): ShiftLog {
  const now = new Date().toISOString();
  return {
    ...shift,
    symptoms: shift.symptoms.map((s) => (s.id === symptomId ? { ...s, coping } : s)),
    updatedAt: now,
  };
}

// 施術記録を今日のシフトに追記する。
export function attachSessionToTodayShift(shifts: ShiftLog[], session: TreatmentSession): ShiftLog {
  const today = todayISODate();
  const now = new Date().toISOString();
  const existing = findTodayShift(shifts) ?? blankShift(today, now);
  return {
    ...existing,
    sessions: [...existing.sessions, session],
    updatedAt: now,
  };
}

// 「今日は休み」を記録する（正常日/故障日などの集計から除外するため）。
export function markTodayOff(shifts: ShiftLog[]): ShiftLog {
  const today = todayISODate();
  const now = new Date().toISOString();
  const existing = findTodayShift(shifts) ?? blankShift(today, now);
  return { ...existing, dayOff: true, updatedAt: now };
}
