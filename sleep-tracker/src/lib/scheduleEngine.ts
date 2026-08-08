// 分割睡眠スケジュールの提案ロジック（ルールベース）。
// 1) 退勤時刻 + 支度・帰宅時間 → コア睡眠の開始・終了を算出（過去のコア睡眠時間の平均を採用）。
// 2) 過去のモヤ記録を時間帯（時）ごとに集計し、発生頻度×強度が高い時間帯の直前に予防仮眠を提案。

import type { SleepRecord } from '../types/sleep';
import type { ScheduleSuggestion } from '../types/schedule';
import { fromMinutes, formatShiftClock, rangeMinutes } from './time';
import { groggyHourBuckets } from './analysis';

const PREP_MIN = 60; // 退勤 → コア睡眠開始までの支度・帰宅時間
const DEFAULT_CORE_MIN = 210; // 過去データが無い場合のデフォルト（3.5時間）
const MIN_CORE_MIN = 120;
const MAX_CORE_MIN = 300;
const PRE_NAP_LEAD_MIN = 30; // 予防仮眠は予測時間帯の30分前に開始
const PRE_NAP_LEN_MIN = 20;
const MIN_SAMPLES_FOR_PREDICTION = 2;

function averageCoreDurationMin(records: SleepRecord[]): number {
  if (records.length === 0) return DEFAULT_CORE_MIN;
  const durations = records.map((r) => rangeMinutes(r.coreSleep)).filter((m) => m > 0);
  if (durations.length === 0) return DEFAULT_CORE_MIN;
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  return Math.min(MAX_CORE_MIN, Math.max(MIN_CORE_MIN, Math.round(avg)));
}

function topGroggyHours(records: SleepRecord[], limit = 2) {
  return groggyHourBuckets(records)
    .filter((b) => b.count >= MIN_SAMPLES_FOR_PREDICTION)
    .slice(0, limit);
}

export function buildScheduleSuggestion(workEndTime: string, history: SleepRecord[]): ScheduleSuggestion {
  const coreDuration = averageCoreDurationMin(history);
  const coreStartElapsed = PREP_MIN;
  const coreEndElapsed = PREP_MIN + coreDuration;

  const coreSleep = {
    start: formatShiftClock(workEndTime, coreStartElapsed),
    end: formatShiftClock(workEndTime, coreEndElapsed),
  };

  const groggy = topGroggyHours(history);
  const naps: { start: string; end: string }[] = [];
  const preventiveNapNotes: string[] = [];

  if (groggy.length === 0) {
    preventiveNapNotes.push(
      history.length === 0
        ? '記録を貯めると、モヤが出やすい時間帯を検出して予防仮眠を提案できるようになります。'
        : 'まだモヤの記録が少ないため、時間帯の傾向は検出できていません（同じ時間帯で2件以上の記録が必要です）。'
    );
  } else {
    for (const g of groggy) {
      const napStartMin = ((g.hour * 60 - PRE_NAP_LEAD_MIN) % 1440 + 1440) % 1440;
      naps.push({
        start: fromMinutes(napStartMin),
        end: fromMinutes(napStartMin + PRE_NAP_LEN_MIN),
      });
      preventiveNapNotes.push(
        `過去${g.count}件の記録から、${g.hour}時台にモヤが出やすい傾向（平均強度${g.avgIntensity.toFixed(1)}）。${fromMinutes(
          napStartMin
        )} 頃に予防仮眠を推奨。`
      );
    }
  }

  return { workEndTime, coreSleep, naps, preventiveNapNotes };
}
