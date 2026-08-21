// 実践期間（区切り）とストリーク。
//
// ⚠ 設計方針（仕様の「連続実践〇日を煽りすぎない」に対応）:
//   ゴーストモードは「最低1ヶ月」で、無期限の実践は想定されていない。
//   連続日数を主役にすると、1日抜けただけで台無しに感じて離脱しやすい。
//   そこで **主役は「期間の◯日目 / 全◯日」** にして、連続日数は補助情報に留める。
//   途切れても 0 に戻して見せるのではなく、「これまでに実践した日数」を併せて出す。

import { addDays, diffDays, toKey } from './date.js';
import { completionRate } from './habits.js';
import type { Cycle, DayRecord, Habit } from '../types/index.js';

/** 1期間の既定の長さ（ゴーストモードの推奨＝最低1ヶ月） */
export const DEFAULT_CYCLE_DAYS = 30;
/** 「実践した日」とみなす達成率のしきい値（全部できた日だけを数えると続かない） */
export const PRACTICED_THRESHOLD = 0.5;

export function makeCycle(startDate: string, goal: string, at: number, lengthDays = DEFAULT_CYCLE_DAYS): Cycle {
  return {
    id: `cycle-${at}`,
    startDate,
    lengthDays: Math.max(7, Math.min(120, Math.round(lengthDays))),
    goal: String(goal || '').trim().slice(0, 80),
    endedAt: null,
    decision: null,
    closingNote: '',
  };
}

export function currentCycle(cycles: Cycle[]): Cycle | null {
  return cycles.find((c) => c.endedAt === null) || null;
}

export interface CycleProgress {
  cycle: Cycle;
  /** 何日目か（1始まり）。開始前は0 */
  dayNumber: number;
  lengthDays: number;
  /** 期間内で実践した日数 */
  practicedDays: number;
  /** 残り日数（0未満にはしない） */
  remaining: number;
  /** 期間の終わりに達したか＝振り返って続けるか決める時 */
  reachedEnd: boolean;
  endDate: string;
}

export function cycleProgress(cycle: Cycle, days: Record<string, DayRecord>, habits: Habit[], today: string): CycleProgress {
  const passed = diffDays(cycle.startDate, today);
  const dayNumber = passed < 0 ? 0 : passed + 1;
  const endDate = addDays(cycle.startDate, cycle.lengthDays - 1);

  let practiced = 0;
  for (let i = 0; i < cycle.lengthDays; i += 1) {
    const key = addDays(cycle.startDate, i);
    if (diffDays(key, today) < 0) break; // 未来の日は数えない
    const record = days[key];
    if (record && completionRate(record, habits) >= PRACTICED_THRESHOLD) practiced += 1;
  }

  return {
    cycle,
    dayNumber: Math.min(dayNumber, cycle.lengthDays),
    lengthDays: cycle.lengthDays,
    practicedDays: practiced,
    remaining: Math.max(0, cycle.lengthDays - dayNumber),
    reachedEnd: dayNumber >= cycle.lengthDays,
    endDate,
  };
}

/** 期間の終わりに達したら、続けるかどうかを本人に決めてもらう */
export function shouldPromptClosing(progress: CycleProgress | null): boolean {
  return Boolean(progress && progress.reachedEnd && progress.cycle.endedAt === null);
}

export interface StreakInfo {
  /** 今つながっている日数 */
  current: number;
  /** これまでで一番長かった日数 */
  longest: number;
  /** 途切れたのが「昨日」か（今日から戻せる、と伝えるため） */
  brokenYesterday: boolean;
}

/**
 * 連続実践日数。今日はまだ記録がなくても途切れ扱いにしない
 * （夜に書く人にとって、昼に開いた時点で0と出るのは事実に反する）。
 */
export function streak(days: Record<string, DayRecord>, habits: Habit[], today: string): StreakInfo {
  const practiced = (key: string) => {
    const r = days[key];
    return Boolean(r) && completionRate(r, habits) >= PRACTICED_THRESHOLD;
  };

  let current = 0;
  let cursor = practiced(today) ? today : addDays(today, -1);
  while (practiced(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const keys = Object.keys(days).filter(practiced).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of keys) {
    run = prev && diffDays(prev, key) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = key;
  }

  const yesterday = addDays(today, -1);
  return {
    current,
    longest,
    brokenYesterday: current === 0 && !practiced(yesterday) && practiced(addDays(today, -2)),
  };
}

/** 通算の実践日数（途切れても消えないもの＝ここを主役に出す） */
export function totalPracticedDays(days: Record<string, DayRecord>, habits: Habit[]): number {
  return Object.values(days).filter((r) => completionRate(r, habits) >= PRACTICED_THRESHOLD).length;
}

/** 今日の日付（画面から呼ぶ。テスト対象のロジックには now を引数で渡す） */
export function todayKey(now: number = Date.now()): string {
  return toKey(new Date(now));
}
