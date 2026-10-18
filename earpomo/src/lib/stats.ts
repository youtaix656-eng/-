// 記録の集計（純粋関数）。保存せず、毎回 records から導く。

import { addDaysKey, daysBetweenKeys, startOfMonthKey, startOfWeekKey, todayKey, weekdayOf, WEEKDAYS, shortDate } from './date.js';
import type { DateKey, SessionRecord } from '../types/index.js';

export type Range = 'today' | 'week' | 'month';

export function rangeKeys(range: Range, today: DateKey): { from: DateKey; to: DateKey } {
  if (range === 'today') return { from: today, to: today };
  if (range === 'week') {
    const from = startOfWeekKey(today);
    return { from, to: addDaysKey(from, 6) };
  }
  const from = startOfMonthKey(today);
  const y = Number(from.slice(0, 4));
  const m = Number(from.slice(5, 7));
  const last = new Date(y, m, 0).getDate();
  return { from, to: `${from.slice(0, 7)}-${String(last).padStart(2, '0')}` };
}

export function inRange(r: SessionRecord, from: DateKey, to: DateKey): boolean {
  return r.date >= from && r.date <= to;
}

/** 集中した合計（分）。飛ばした分も、集中していた時間は数える */
export function totalMinutes(records: SessionRecord[], range: Range, today: DateKey = todayKey()): number {
  const { from, to } = rangeKeys(range, today);
  return records.filter((r) => inRange(r, from, to)).reduce((a, r) => a + r.durationMinutes, 0);
}

/** 完了ポモ数（最後まで集中できた回数） */
export function completedCount(records: SessionRecord[], range: Range, today: DateKey = todayKey()): number {
  const { from, to } = rangeKeys(range, today);
  return records.filter((r) => inRange(r, from, to) && r.completed).length;
}

/**
 * 連続達成日数：完了ポモが1つ以上ある日が、今日（今日がまだ無ければ昨日）から何日続いているか。
 */
export function streakDays(records: SessionRecord[], today: DateKey = todayKey()): number {
  const days = new Set(records.filter((r) => r.completed).map((r) => r.date));
  let cursor = days.has(today) ? today : addDaysKey(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDaysKey(cursor, -1);
  }
  return n;
}

export interface DayBar {
  date: DateKey;
  weekday: string;
  /** 'M/D' */
  label: string;
  minutes: number;
  isToday: boolean;
}

/** 今週（月〜日）の日ごとの集中時間 */
export function weekBars(records: SessionRecord[], today: DateKey = todayKey()): DayBar[] {
  const from = startOfWeekKey(today);
  const out: DayBar[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysKey(from, i);
    const minutes = records.filter((r) => r.date === date).reduce((a, r) => a + r.durationMinutes, 0);
    out.push({ date, weekday: WEEKDAYS[weekdayOf(date)], label: shortDate(date), minutes, isToday: date === today });
  }
  return out;
}

export interface TagRow {
  tag: string;
  minutes: number;
}

export const NO_TAG_LABEL = 'タグなし';

/** タグ別内訳（多い順。同じ分数なら名前順で安定させる） */
export function tagBreakdown(records: SessionRecord[], range: Range, today: DateKey = todayKey()): TagRow[] {
  const { from, to } = rangeKeys(range, today);
  const map = new Map<string, number>();
  for (const r of records) {
    if (!inRange(r, from, to)) continue;
    const key = r.tag && r.tag.trim() ? r.tag.trim() : NO_TAG_LABEL;
    map.set(key, (map.get(key) || 0) + r.durationMinutes);
  }
  return [...map.entries()]
    .map(([tag, minutes]) => ({ tag, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.tag.localeCompare(b.tag, 'ja'));
}

/** 最近使ったタグ（新しい順・重複なし） */
export function recentTags(records: SessionRecord[], limit = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of [...records].sort((a, b) => b.startedAt - a.startedAt)) {
    const t = r.tag && r.tag.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

/** 試験日まで残り何日か（今日なら 0、過ぎていれば負） */
export function daysUntil(date: DateKey, today: DateKey = todayKey()): number {
  return daysBetweenKeys(today, date);
}
