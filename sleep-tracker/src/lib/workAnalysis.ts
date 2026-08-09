// 勤務ログ（施術中コンディション記録）の相関分析・集計ロジック。
// 「換気扇・カフェイン・前夜睡眠のどれが眠気症状の主因か」を切り分けるための土台。

import type { CopingMethod, ShiftLog, SymptomType, TreatmentType } from '../types/work';
import { SYMPTOM_TYPE_LABELS } from '../types/work';
import type { SleepRecord } from '../types/sleep';
import { toMinutes } from './time';

function workedShifts(shifts: ShiftLog[]): ShiftLog[] {
  return shifts.filter((s) => !s.dayOff && s.startTime);
}

export interface GroupStats {
  days: number;
  symptomCount: number;
  avgIntensity: number;
  perDay: number; // 1日あたりの症状件数
}

function summarizeGroup(group: ShiftLog[]): GroupStats {
  const symptoms = group.flatMap((s) => s.symptoms);
  const avgIntensity = symptoms.length ? symptoms.reduce((a, s) => a + s.intensity, 0) / symptoms.length : 0;
  return {
    days: group.length,
    symptomCount: symptoms.length,
    avgIntensity: Math.round(avgIntensity * 10) / 10,
    perDay: group.length ? Math.round((symptoms.length / group.length) * 10) / 10 : 0,
  };
}

// ① 換気扇 正常日 vs 故障日
export function ventilationSymptomStats(shifts: ShiftLog[]): { normal: GroupStats; broken: GroupStats } {
  const worked = workedShifts(shifts);
  return {
    normal: summarizeGroup(worked.filter((s) => s.ventilation === 'normal')),
    broken: summarizeGroup(worked.filter((s) => s.ventilation === 'broken')),
  };
}

// ② カフェイン摂取 有無
export function caffeineSymptomStats(shifts: ShiftLog[]): { withCaffeine: GroupStats; withoutCaffeine: GroupStats } {
  const worked = workedShifts(shifts);
  return {
    withCaffeine: summarizeGroup(worked.filter((s) => s.caffeine.taken)),
    withoutCaffeine: summarizeGroup(worked.filter((s) => !s.caffeine.taken)),
  };
}

// ③ 前夜睡眠時間の帯ごと
export interface SleepBucketStats extends GroupStats {
  label: string;
}

const SLEEP_BUCKETS = [
  { label: '〜3h', max: 3 },
  { label: '3〜5h', max: 5 },
  { label: '5〜7h', max: 7 },
  { label: '7h〜', max: Infinity },
];

export function priorSleepVsSymptoms(shifts: ShiftLog[]): SleepBucketStats[] {
  const worked = workedShifts(shifts).filter((s) => s.priorSleepHours !== undefined);
  let lower = -Infinity;
  const result: SleepBucketStats[] = [];
  for (const b of SLEEP_BUCKETS) {
    const group = worked.filter((s) => s.priorSleepHours! > lower && s.priorSleepHours! <= b.max);
    result.push({ label: b.label, ...summarizeGroup(group) });
    lower = b.max;
  }
  return result.filter((r) => r.days > 0);
}

// ⑤ 3要因を比較して「今いちばん怪しい原因」を出す簡易スコアリング
export interface SuspectFactor {
  factor: 'ventilation' | 'caffeine' | 'sleep';
  label: string;
  detail: string;
  severity: 'high' | 'medium';
}

function severityOf(diff: number): 'high' | 'medium' {
  return Math.abs(diff) >= 1.5 ? 'high' : 'medium';
}

export function suspectScore(shifts: ShiftLog[]): SuspectFactor[] {
  const results: SuspectFactor[] = [];

  const vent = ventilationSymptomStats(shifts);
  if (vent.normal.days > 0 && vent.broken.days > 0) {
    const diff = vent.broken.perDay - vent.normal.perDay;
    if (Math.abs(diff) >= 0.5) {
      results.push({
        factor: 'ventilation',
        label: '換気扇の故障',
        detail: `故障日は1日あたり${vent.broken.perDay}件、正常日は${vent.normal.perDay}件`,
        severity: severityOf(diff),
      });
    }
  }

  const caf = caffeineSymptomStats(shifts);
  if (caf.withCaffeine.days > 0 && caf.withoutCaffeine.days > 0) {
    const diff = caf.withCaffeine.perDay - caf.withoutCaffeine.perDay;
    if (Math.abs(diff) >= 0.5) {
      results.push({
        factor: 'caffeine',
        label: 'カフェイン摂取',
        detail: `摂取日は1日あたり${caf.withCaffeine.perDay}件、非摂取日は${caf.withoutCaffeine.perDay}件`,
        severity: severityOf(diff),
      });
    }
  }

  const buckets = priorSleepVsSymptoms(shifts);
  if (buckets.length >= 2) {
    const sorted = [...buckets].sort((a, b) => b.perDay - a.perDay);
    const worst = sorted[0];
    const best = sorted[sorted.length - 1];
    const diff = worst.perDay - best.perDay;
    if (diff >= 0.5) {
      results.push({
        factor: 'sleep',
        label: '前夜の睡眠時間',
        detail: `${worst.label}の日が1日あたり${worst.perDay}件と最多、${best.label}の日は${best.perDay}件`,
        severity: severityOf(diff),
      });
    }
  }

  const weight = { high: 2, medium: 1 } as const;
  return results.sort((a, b) => weight[b.severity] - weight[a.severity]);
}

// ⑥⑦ 対処法ごとの効果集計
export interface CopingStat {
  method: CopingMethod;
  worked: number;
  noEffect: number;
  unknown: number;
  total: number;
  workedRate: number;
}

export function copingEffectSummary(shifts: ShiftLog[]): CopingStat[] {
  const tally = new Map<CopingMethod, { worked: number; noEffect: number; unknown: number }>();
  for (const shift of shifts) {
    for (const symptom of shift.symptoms) {
      if (!symptom.coping) continue;
      for (const m of symptom.coping.methods) {
        const cur = tally.get(m) ?? { worked: 0, noEffect: 0, unknown: 0 };
        if (symptom.coping.effect === 'worked') cur.worked += 1;
        else if (symptom.coping.effect === 'no_effect') cur.noEffect += 1;
        else cur.unknown += 1;
        tally.set(m, cur);
      }
    }
  }
  return [...tally.entries()]
    .map(([method, v]) => {
      const total = v.worked + v.noEffect + v.unknown;
      return { method, worked: v.worked, noEffect: v.noEffect, unknown: v.unknown, total, workedRate: total ? v.worked / total : 0 };
    })
    .sort((a, b) => b.workedRate - a.workedRate || b.total - a.total);
}

// ⑧ 「前回この症状のときに効いた対処法」を探す
export function lastWorkingCopingFor(shifts: ShiftLog[], symptomTypes: SymptomType[]): CopingMethod | null {
  const sorted = [...shifts].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const shift of sorted) {
    const symptomsSorted = [...shift.symptoms].sort((a, b) => b.time.localeCompare(a.time));
    for (const s of symptomsSorted) {
      if (!s.coping || s.coping.effect !== 'worked') continue;
      if (s.types.some((t) => symptomTypes.includes(t))) {
        return s.coping.methods[0] ?? null;
      }
    }
  }
  return null;
}

// ⑩ 施術種別ごとの症状発生率
export interface TreatmentTypeStat {
  type: TreatmentType;
  sessionCount: number;
  symptomCount: number;
  rate: number; // 1施術あたりの症状件数
}

function isWithinRange(time: string, start: string, end: string): boolean {
  const t = toMinutes(time);
  const s = toMinutes(start);
  const e = toMinutes(end);
  return e > s ? t >= s && t <= e : t >= s || t <= e;
}

export function treatmentTypeSymptomStats(shifts: ShiftLog[]): TreatmentTypeStat[] {
  const tally = new Map<TreatmentType, { sessions: number; symptoms: number }>();
  for (const shift of shifts) {
    for (const session of shift.sessions) {
      const cur = tally.get(session.type) ?? { sessions: 0, symptoms: 0 };
      cur.sessions += 1;
      cur.symptoms += shift.symptoms.filter((sym) => isWithinRange(sym.time, session.startTime, session.endTime)).length;
      tally.set(session.type, cur);
    }
  }
  return [...tally.entries()]
    .map(([type, v]) => ({
      type,
      sessionCount: v.sessions,
      symptomCount: v.symptoms,
      rate: v.sessions ? Math.round((v.symptoms / v.sessions) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.rate - a.rate);
}

// ⑫ 勤務開始からの経過時間
export function minutesSinceShiftStart(shift: ShiftLog, time: string): number | null {
  if (!shift.startTime) return null;
  const diff = toMinutes(time) - toMinutes(shift.startTime);
  return diff >= 0 ? diff : diff + 1440;
}

export function formatElapsed(min: number): string {
  if (min < 60) return `開始${min}分後`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `開始${h}時間${m > 0 ? `${m}分` : ''}後`;
}

// ⑰⑱ 週次サマリー：最も症状が出た時間帯／カフェイン有無での比較
export interface WeeklyWorkSummary {
  peakHourLabel: string | null;
  peakHourCount: number;
  caffeineDayAvg: number;
  nonCaffeineDayAvg: number;
}

function recentCutoffISO(days: number): string {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
}

export function weeklyWorkSummary(shifts: ShiftLog[], days = 7): WeeklyWorkSummary {
  const cutoffISO = recentCutoffISO(days);
  const recent = shifts.filter((s) => s.date >= cutoffISO);

  const hourCounts = new Map<number, number>();
  for (const shift of recent) {
    for (const sym of shift.symptoms) {
      const hour = Math.floor(toMinutes(sym.time) / 60) % 24;
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }
  }
  let peakHour: number | null = null;
  let peakCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > peakCount) {
      peakHour = hour;
      peakCount = count;
    }
  }

  const caf = caffeineSymptomStats(recent);
  return {
    peakHourLabel: peakHour !== null ? `${peakHour}時台` : null,
    peakHourCount: peakCount,
    caffeineDayAvg: caf.withCaffeine.perDay,
    nonCaffeineDayAvg: caf.withoutCaffeine.perDay,
  };
}

// ⑳ 睡眠アプリの「モヤ」と勤務ログの「症状」を1つの時系列に統合する
export interface DrowsinessEvent {
  date: string;
  time: string;
  label: string;
  intensity: number;
  source: 'sleep' | 'work';
}

export function combinedDrowsinessTimeline(records: SleepRecord[], shifts: ShiftLog[], days = 14): DrowsinessEvent[] {
  const cutoffISO = recentCutoffISO(days);
  const events: DrowsinessEvent[] = [];

  for (const r of records) {
    if (r.date < cutoffISO) continue;
    for (const g of r.grogginessPeriods) {
      events.push({ date: r.date, time: g.start, label: 'モヤ（睡眠アプリ）', intensity: g.intensity, source: 'sleep' });
    }
  }

  for (const s of shifts) {
    if (s.date < cutoffISO) continue;
    for (const sym of s.symptoms) {
      events.push({
        date: s.date,
        time: sym.time,
        label: sym.types.map((t) => SYMPTOM_TYPE_LABELS[t]).join('/'),
        intensity: sym.intensity,
        source: 'work',
      });
    }
  }

  return events.sort((a, b) => (a.date === b.date ? b.time.localeCompare(a.time) : a.date < b.date ? 1 : -1));
}
