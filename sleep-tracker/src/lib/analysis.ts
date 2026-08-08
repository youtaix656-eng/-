// ダッシュボード／ホーム／スケジュール提案で共有する集計ロジック。

import type { NapAfterState, SleepRecord, WakeState } from '../types/sleep';
import { toMinutes } from './time';

export interface GroggyBucket {
  hour: number; // 0-23
  count: number;
  avgIntensity: number;
}

// モヤの発生を開始時刻の「時」単位でバケット化し、件数の多い順に並べる。
export function groggyHourBuckets(records: SleepRecord[]): GroggyBucket[] {
  const buckets = new Map<number, { count: number; sum: number }>();
  for (const r of records) {
    for (const g of r.grogginessPeriods) {
      const hour = Math.floor(toMinutes(g.start) / 60) % 24;
      const cur = buckets.get(hour) ?? { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += g.intensity;
      buckets.set(hour, cur);
    }
  }
  return [...buckets.entries()]
    .map(([hour, v]) => ({ hour, count: v.count, avgIntensity: v.sum / v.count }))
    .sort((a, b) => b.count * b.avgIntensity - a.count * a.avgIntensity);
}

// 0-23時ぶん、値の無い時間も0埋めして返す（ヒートマップ表示用）。
export function groggyHourGrid(records: SleepRecord[]): GroggyBucket[] {
  const byHour = new Map(groggyHourBuckets(records).map((b) => [b.hour, b]));
  return Array.from({ length: 24 }, (_, hour) => byHour.get(hour) ?? { hour, count: 0, avgIntensity: 0 });
}

export interface NapEffectSummary {
  total: number;
  refreshed: number;
  neutral: number;
  groggy: number;
  refreshedRate: number; // 0-1
}

export function napEffectSummary(records: SleepRecord[]): NapEffectSummary {
  const counts: Record<NapAfterState, number> = { refreshed: 0, neutral: 0, groggy: 0 };
  let total = 0;
  for (const r of records) {
    for (const n of r.naps) {
      counts[n.afterState] += 1;
      total += 1;
    }
  }
  return {
    total,
    refreshed: counts.refreshed,
    neutral: counts.neutral,
    groggy: counts.groggy,
    refreshedRate: total === 0 ? 0 : counts.refreshed / total,
  };
}

// 起床直後の状態 × 学習パフォーマンスの相関（-1〜1の目安値、簡易ピアソン相関）。
export function wakeStudyCorrelation(records: SleepRecord[]): number | null {
  if (records.length < 3) return null;
  const xs = records.map((r) => r.wakeState);
  const ys = records.map((r) => r.studyPerformance);
  const n = xs.length;
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return null;
  return num / Math.sqrt(dx2 * dy2);
}

export function wakeStudyMatrix(records: SleepRecord[]): number[][] {
  // [wakeState-1][studyPerformance-1] = 件数
  const matrix: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const r of records) {
    matrix[(r.wakeState as WakeState) - 1][r.studyPerformance - 1] += 1;
  }
  return matrix;
}
