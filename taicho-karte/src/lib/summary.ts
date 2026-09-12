// ホームの直近サマリー（保存せず毎回導く）。
// 出すのは件数・部位別の回数・VASの幅だけ。平均や点数は出さない
// （1と9が1回ずつの平均5は「中くらいの痛みが2回」ではない）。

import type { CareRecord, SymptomRecord } from '../types/index.js';
import { DAY_MS, keyOf } from './date.js';
import { effectRank } from '../data/effects.js';

export interface RecentSummary {
  days: number;
  /** 期間内の症状記録の件数 */
  symptomCount: number;
  /** 記録があった日数 */
  recordedDays: number;
  /** 部位別の件数（多い順。同数は id 順で安定） */
  byRegion: { regionId: string; count: number }[];
  /** VAS の最小〜最大（記録が無ければ null） */
  vasRange: { min: number; max: number } | null;
  /** 期間内の対応策の件数 */
  careCount: number;
  /** 期間内で「軽減」「大幅改善」だった対応策の件数 */
  helpedCount: number;
}

export function recentSummary(
  symptoms: readonly SymptomRecord[],
  cares: readonly CareRecord[],
  days: number,
  now: number = Date.now(),
): RecentSummary {
  const since = now - days * DAY_MS;
  const inRange = symptoms.filter((s) => s.at >= since && s.at <= now);
  const counts = new Map<string, number>();
  const daySet = new Set<string>();
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of inRange) {
    counts.set(s.regionId, (counts.get(s.regionId) ?? 0) + 1);
    daySet.add(keyOf(s.at));
    if (s.vas < min) min = s.vas;
    if (s.vas > max) max = s.vas;
  }
  const byRegion = [...counts.entries()]
    .map(([regionId, count]) => ({ regionId, count }))
    .sort((a, b) => b.count - a.count || (a.regionId < b.regionId ? -1 : 1));
  const caresIn = cares.filter((c) => c.at >= since && c.at <= now);
  return {
    days,
    symptomCount: inRange.length,
    recordedDays: daySet.size,
    byRegion,
    vasRange: inRange.length ? { min, max } : null,
    careCount: caresIn.length,
    helpedCount: caresIn.filter((c) => effectRank(c.effect) >= 2).length,
  };
}

/** 直近の記録（新しい順に n 件） */
export function latestSymptoms(symptoms: readonly SymptomRecord[], n: number): SymptomRecord[] {
  return [...symptoms].sort((a, b) => b.at - a.at).slice(0, n);
}

/** 対応策に紐づけやすいよう、直近の症状を新しい順に返す（既定 30 日） */
export function linkableSymptoms(symptoms: readonly SymptomRecord[], now: number = Date.now(), days = 30): SymptomRecord[] {
  const since = now - days * DAY_MS;
  return [...symptoms].filter((s) => s.at >= since).sort((a, b) => b.at - a.at);
}
