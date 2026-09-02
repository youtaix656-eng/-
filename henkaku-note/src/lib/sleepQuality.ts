// 本書の「良質な睡眠の最低条件」。
//
// 既存の shift.ts（就寝ルール）とは**層が違う**ので分けてある。
//   shift.ts       … いつ寝たか（シフトから決まる就寝目標に対する実績）
//   sleepQuality.ts … どう眠れたか（寝つき・中途覚醒・睡眠効率）
// 画面では同じカードにまとめるが、ロジックは混ぜない。
//
// 出典: 解説動画の要約（本人入力・一次資料未確認）。
// 本書は「一つでも当てはまらないと睡眠不足になる」としているが、
// このアプリは**足りない項目を挙げるだけ**で、睡眠不足だと断定しない。

import type { SleepQualityRecord } from '../types/index.js';

export interface SleepCriterion {
  id: string;
  label: string;
  /** 満たしているか。判断できない時は null */
  test: (q: SleepQualityRecord) => boolean | null;
  hint: string;
}

export const FALL_ASLEEP_LIMIT = 30;
export const AWAKENING_LIMIT = 1;
export const BACK_TO_SLEEP_LIMIT = 20;
export const EFFICIENCY_LIMIT = 85;

/** 睡眠時間の望ましい範囲（本書：1日7〜9時間。寝過ぎもよくない） */
export const SLEEP_HOURS_MIN = 7;
export const SLEEP_HOURS_MAX = 9;

export const SLEEP_CRITERIA: SleepCriterion[] = [
  {
    id: 'fall_asleep',
    label: `眠りに落ちるまで${FALL_ASLEEP_LIMIT}分以内`,
    test: (q) => (q.fallAsleepMinutes === null ? null : q.fallAsleepMinutes <= FALL_ASLEEP_LIMIT),
    hint: 'ベッドで寝る以外のことをしていると、寝つきが悪くなるとされます。',
  },
  {
    id: 'awakenings',
    label: `夜中に起きるのは${AWAKENING_LIMIT}回まで`,
    test: (q) => (q.awakenings === null ? null : q.awakenings <= AWAKENING_LIMIT),
    hint: '夜は室内の照明を限界まで暗くすると、メラトニンが出やすくなるとされます。',
  },
  {
    id: 'back_to_sleep',
    label: `目が覚めても${BACK_TO_SLEEP_LIMIT}分以内に再び眠れる`,
    test: (q) => (q.awakenings === 0 ? true : q.backToSleepWithin20),
    hint: '日中に太陽光を浴びると体内時計が整いやすいとされます。',
  },
  {
    id: 'efficiency',
    label: `寝床にいた時間の${EFFICIENCY_LIMIT}%以上を眠っている`,
    test: (q) => {
      const e = efficiencyOf(q);
      return e === null ? null : e >= EFFICIENCY_LIMIT;
    },
    hint: '眠くないのに寝床にいる時間が長いと、この割合が下がります。',
  },
];

/** 睡眠効率（%）。材料がそろっていなければ null（0にしない） */
export function efficiencyOf(q: SleepQualityRecord): number | null {
  if (!q.inBedMinutes || !q.sleptMinutes) return null;
  if (q.inBedMinutes <= 0) return null;
  return Math.round((q.sleptMinutes / q.inBedMinutes) * 100);
}

export interface SleepQualityResult {
  met: SleepCriterion[];
  unmet: SleepCriterion[];
  unknown: SleepCriterion[];
  efficiency: number | null;
  /** 全部そろって満たしているか。判断できない項目があれば null */
  allMet: boolean | null;
}

export function judgeSleepQuality(q: SleepQualityRecord | undefined): SleepQualityResult {
  const rec = q ?? emptySleepQuality();
  const met: SleepCriterion[] = [];
  const unmet: SleepCriterion[] = [];
  const unknown: SleepCriterion[] = [];
  for (const c of SLEEP_CRITERIA) {
    const r = c.test(rec);
    if (r === null) unknown.push(c);
    else if (r) met.push(c);
    else unmet.push(c);
  }
  return {
    met,
    unmet,
    unknown,
    efficiency: efficiencyOf(rec),
    allMet: unknown.length > 0 ? null : unmet.length === 0,
  };
}

export function emptySleepQuality(): SleepQualityRecord {
  return {
    fallAsleepMinutes: null,
    awakenings: null,
    backToSleepWithin20: null,
    inBedMinutes: null,
    sleptMinutes: null,
  };
}

export type DurationVerdict = 'short' | 'in_range' | 'long' | 'unknown';

/** 睡眠時間が7〜9時間の範囲か。範囲外でも責める文言は返さない */
export function durationVerdict(q: SleepQualityRecord | undefined): { verdict: DurationVerdict; hours: number | null; text: string } {
  const minutes = q?.sleptMinutes ?? null;
  if (!minutes || minutes <= 0) return { verdict: 'unknown', hours: null, text: '睡眠時間の記録がありません。' };
  const hours = Math.round((minutes / 60) * 10) / 10;
  if (hours < SLEEP_HOURS_MIN) {
    return { verdict: 'short', hours, text: `${hours}時間。本書の目安（${SLEEP_HOURS_MIN}〜${SLEEP_HOURS_MAX}時間）より短めです。` };
  }
  if (hours > SLEEP_HOURS_MAX) {
    return { verdict: 'long', hours, text: `${hours}時間。本書の目安より長めです（寝過ぎもよくないとされます）。` };
  }
  return { verdict: 'in_range', hours, text: `${hours}時間。本書の目安（${SLEEP_HOURS_MIN}〜${SLEEP_HOURS_MAX}時間）の範囲です。` };
}

/** 期間の集計。満たせなかった項目の内訳を返す（点数にはしない） */
export function summarizeSleepQuality(records: (SleepQualityRecord | undefined)[]) {
  let recorded = 0;
  let allMetDays = 0;
  const unmetCounts = new Map<string, number>();
  for (const q of records) {
    if (!q) continue;
    const filled = Object.values(q).some((v) => v !== null);
    if (!filled) continue;
    recorded += 1;
    const r = judgeSleepQuality(q);
    if (r.allMet === true) allMetDays += 1;
    for (const c of r.unmet) unmetCounts.set(c.id, (unmetCounts.get(c.id) ?? 0) + 1);
  }
  const worst = [...unmetCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    recorded,
    allMetDays,
    /** 一番よく外れていた条件。材料が足りなければ null */
    weakest: worst && recorded >= 3 ? SLEEP_CRITERIA.find((c) => c.id === worst[0]) ?? null : null,
    weakestCount: worst ? worst[1] : 0,
  };
}
