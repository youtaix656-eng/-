// 「今日の記録」に断片的な入力を後から重ね書きするためのヘルパー群。
// 起床直後は最低限（就寝・起床・気分）だけ、仮眠やモヤは気づいたときに後から追記、
// という段階的な入力を1つのレコードにマージしていく。

import type { GrogginessPeriod, Nap, SleepRecord, StudyPerformance, WakeState } from '../types/sleep';
import { computeTotalSleepHours } from './calc';
import { newId } from './id';
import { todayISODate } from './time';

// 短いメモを既存メモに時刻付きで追記する（複数のクイック入力が同じ日に重なっても潰れない）。
export function appendMemo(existing: string, addition: string): string {
  if (!addition.trim()) return existing;
  const time = new Date().toTimeString().slice(0, 5);
  const line = `[${time}] ${addition.trim()}`;
  return existing ? `${existing}\n${line}` : line;
}

function blankRecord(date: string, now: string): SleepRecord {
  const coreSleep = { start: '', end: '' };
  return {
    id: newId(),
    date,
    coreSleep,
    wakeState: 3,
    naps: [],
    grogginessPeriods: [],
    totalSleepHours: 0,
    studyPerformance: 3,
    memo: '',
    createdAt: now,
    updatedAt: now,
  };
}

// 仮眠（タイマー経由・後追い入力どちらも）を今日のレコードに追記する。
export function attachNapToTodayRecord(records: SleepRecord[], nap: Nap, memo?: string): SleepRecord {
  const today = todayISODate();
  const now = new Date().toISOString();
  const existing = records.find((r) => r.date === today) ?? blankRecord(today, now);
  const naps = [...existing.naps, nap];
  return {
    ...existing,
    naps,
    memo: appendMemo(existing.memo, memo ?? ''),
    totalSleepHours: computeTotalSleepHours(existing.coreSleep, naps),
    updatedAt: now,
  };
}

// 起床直後クイック記録：就寝・起床・気分の3項目だけを今日のレコードに反映する。
// 既存の仮眠・モヤ・学習パフォーマンス・メモは（あれば）そのまま保持する。
export function applyQuickWakeLog(
  records: SleepRecord[],
  input: { coreStart: string; coreEnd: string; wakeState: WakeState; memo?: string }
): SleepRecord {
  const today = todayISODate();
  const now = new Date().toISOString();
  const existing = records.find((r) => r.date === today) ?? blankRecord(today, now);
  const coreSleep = { start: input.coreStart, end: input.coreEnd };
  return {
    ...existing,
    coreSleep,
    wakeState: input.wakeState,
    memo: appendMemo(existing.memo, input.memo ?? ''),
    totalSleepHours: computeTotalSleepHours(coreSleep, existing.naps),
    updatedAt: now,
  };
}

// モヤ（眠気）をその場で今日のレコードに追記する。
export function attachGroggyToTodayRecord(records: SleepRecord[], period: GrogginessPeriod): SleepRecord {
  const today = todayISODate();
  const now = new Date().toISOString();
  const existing = records.find((r) => r.date === today) ?? blankRecord(today, now);
  return {
    ...existing,
    grogginessPeriods: [...existing.grogginessPeriods, period],
    updatedAt: now,
  };
}

// 夜の振り返り：学習パフォーマンスとメモだけを今日のレコードに反映する。
export function applyEveningReflection(
  records: SleepRecord[],
  input: { studyPerformance: StudyPerformance; memo?: string }
): SleepRecord {
  const today = todayISODate();
  const now = new Date().toISOString();
  const existing = records.find((r) => r.date === today) ?? blankRecord(today, now);
  return {
    ...existing,
    studyPerformance: input.studyPerformance,
    memo: appendMemo(existing.memo, input.memo ?? ''),
    updatedAt: now,
  };
}
