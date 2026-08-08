import type { Nap, SleepRecord } from '../types/sleep';
import { computeTotalSleepHours } from './calc';
import { todayISODate } from './time';

// 仮眠タイマー終了後の記録を「今日のレコード」に追記する。無ければ最小構成で新規作成。
export function attachNapToTodayRecord(records: SleepRecord[], nap: Nap): SleepRecord {
  const today = todayISODate();
  const existing = records.find((r) => r.date === today);
  const now = new Date().toISOString();

  if (existing) {
    const naps = [...existing.naps, nap];
    return {
      ...existing,
      naps,
      totalSleepHours: computeTotalSleepHours(existing.coreSleep, naps),
      updatedAt: now,
    };
  }

  const naps = [nap];
  const coreSleep = { start: '', end: '' };
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}`,
    date: today,
    coreSleep,
    wakeState: 3,
    naps,
    grogginessPeriods: [],
    totalSleepHours: computeTotalSleepHours(coreSleep, naps),
    studyPerformance: 3,
    memo: '',
    createdAt: now,
    updatedAt: now,
  };
}
