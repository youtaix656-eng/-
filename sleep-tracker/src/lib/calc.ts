import type { Nap, TimeRange } from '../types/sleep';
import { rangeMinutes } from './time';

// コア睡眠+仮眠から合計睡眠時間（時間単位・小数1桁）を計算する。
export function computeTotalSleepHours(coreSleep: TimeRange, naps: Nap[]): number {
  const coreMin = rangeMinutes(coreSleep);
  const napMin = naps.reduce((sum, n) => sum + rangeMinutes(n), 0);
  return Math.round(((coreMin + napMin) / 60) * 10) / 10;
}
