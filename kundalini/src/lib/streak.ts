// 継続日数まわりの計算（単一の正）。
//
// 保存しているのは「開始時刻」と「リラプスの記録」だけで、
// **いまの日数・最長記録・通算日数はすべてここで毎回導く**
// （別々に保存すると、片方を直したときに必ず食い違う）。

import { DAY_MS, toKey, daysBetweenKeys } from './date.js';
import type { AppState, DateKey, Relapse } from '../types/index.js';

/** 経過ミリ秒（開始前・未開始は0） */
export function elapsedMs(startedAt: number | null, now: number): number {
  if (startedAt == null) return 0;
  return Math.max(0, now - startedAt);
}

/** いまの継続日数（丸1日ぶんを1と数える。開始当日は0日＝「1日目」） */
export function currentDays(startedAt: number | null, now: number): number {
  return Math.floor(elapsedMs(startedAt, now) / DAY_MS);
}

/** 「◯日目」の表示用（開始当日を1日目とする） */
export function dayOrdinal(startedAt: number | null, now: number): number {
  if (startedAt == null) return 0;
  return currentDays(startedAt, now) + 1;
}

/** 1件のリラプスが終わらせた継続の日数 */
export function relapseDays(r: Relapse): number {
  return Math.max(0, Math.floor((r.at - r.startedAt) / DAY_MS));
}

export interface Span {
  startedAt: number;
  /** null＝いま続いている */
  endedAt: number | null;
  days: number;
}

/** 過去ぶん＋いま続いているぶんの区間を、古い順に並べて返す */
export function spans(state: AppState, now: number): Span[] {
  const past: Span[] = [...state.relapses]
    .sort((a, b) => a.at - b.at)
    .map((r) => ({ startedAt: r.startedAt, endedAt: r.at, days: relapseDays(r) }));
  if (state.startedAt != null) {
    past.push({ startedAt: state.startedAt, endedAt: null, days: currentDays(state.startedAt, now) });
  }
  return past;
}

/** 最長記録（過去といまの大きいほう） */
export function longestDays(state: AppState, now: number): number {
  return spans(state, now).reduce((max, s) => Math.max(max, s.days), 0);
}

/**
 * 通算日数（リセットしても減らない）。
 * リラプスで0に戻るのは「いまの継続」だけで、積み上げてきたぶんは残る
 * ——ここが無いと、戻った日にそれまでが全部消えたように見える。
 */
export function totalDays(state: AppState, now: number): number {
  return spans(state, now).reduce((sum, s) => sum + s.days, 0);
}

export type DayStatus = 'streak' | 'relapse' | 'none';

/** カレンダー1マスの状態（リラプス日が優先） */
export function dayStatus(state: AppState, date: DateKey, now: number): DayStatus {
  for (const r of state.relapses) {
    if (toKey(new Date(r.at)) === date) return 'relapse';
  }
  for (const s of spans(state, now)) {
    const from = toKey(new Date(s.startedAt));
    const to = toKey(new Date(s.endedAt ?? now));
    if (daysBetweenKeys(from, date) >= 0 && daysBetweenKeys(date, to) >= 0) return 'streak';
  }
  return 'none';
}

/** 記録が1つでもあるか（何も無い状態で「0日」と大きく出さないため） */
export function hasStarted(state: AppState): boolean {
  return state.startedAt != null || state.relapses.length > 0;
}
