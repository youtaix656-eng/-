// 分析。
//
// ⚠ このアプリでいちばん壊しやすいのがここ。守る線は3つ：
//   ①**並べるまでで止める**。「SNS → リラプス」のように矢印で結ばない
//     （きっかけの記録は本人の見立てで、原因が確かめられたわけではない）。
//   ②**平均点を出さない**。5段階は順番のある目盛りで、3と5の間隔が
//     2と4の間隔と同じとは限らない。出すのは件数・分布・そのままの推移だけ。
//   ③**件数が少ないうちは順位を出さない**。1件の偏りが「傾向」に見える。

import { WEEKDAYS, TIME_BANDS, bandOf, toKey, daysBetweenKeys, DAY_MS } from './date.js';
import { currentDays, relapseDays, spans } from './streak.js';
import type { AppState, DayRecord, Scale5 } from '../types/index.js';

/** これ未満なら「まだ傾向とは言えない」と画面に出す */
export const MIN_FOR_TREND = 3;

export interface CountRow {
  id: string;
  label: string;
  count: number;
}

/** 曜日別のリラプス件数 */
export function relapsesByWeekday(state: AppState): CountRow[] {
  const rows: CountRow[] = WEEKDAYS.map((label, i) => ({ id: String(i), label, count: 0 }));
  for (const r of state.relapses) rows[new Date(r.at).getDay()].count += 1;
  return rows;
}

/** 時間帯別のリラプス件数 */
export function relapsesByBand(state: AppState): CountRow[] {
  const rows: CountRow[] = TIME_BANDS.map((b) => ({ id: b.id, label: b.label, count: 0 }));
  for (const r of state.relapses) {
    const row = rows.find((x) => x.id === bandOf(r.at));
    if (row) row.count += 1;
  }
  return rows;
}

/** きっかけ別の件数（多い順。同数は元の並び順のまま） */
export function relapsesByTrigger(state: AppState): CountRow[] {
  const map = new Map<string, number>();
  for (const r of state.relapses) {
    for (const t of r.triggers) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return [...map.entries()].map(([id, count]) => ({ id, label: id, count })).sort((a, b) => b.count - a.count);
}

export interface DayPoint {
  date: string;
  /** その日が継続何日目だったか（継続外なら null） */
  days: number | null;
  body: Scale5;
  focus: Scale5;
  mood: Scale5;
}

/**
 * 記録した日を「その日の継続日数」と一緒に並べる。
 * 相関を計算するのではなく、**並べて見せるための材料**を返すだけ。
 */
export function dayPoints(state: AppState, now: number): DayPoint[] {
  const list = Object.values(state.days)
    .filter((d): d is DayRecord => !!d)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const ranges = spans(state, now);
  return list.map((d) => {
    let days: number | null = null;
    for (const s of ranges) {
      const from = toKey(new Date(s.startedAt));
      const to = toKey(new Date(s.endedAt ?? now));
      if (daysBetweenKeys(from, d.date) >= 0 && daysBetweenKeys(d.date, to) >= 0) {
        days = daysBetweenKeys(from, d.date);
        break;
      }
    }
    return { date: d.date, days, body: d.body, focus: d.focus, mood: d.mood };
  });
}

export interface BandRow {
  label: string;
  from: number;
  to: number | null;
  /** その日数帯に入る記録の、5段階ごとの件数（index 0 が「1」） */
  counts: number[];
  total: number;
}

/**
 * 継続日数の帯ごとに、5段階の**分布**を数える（平均は出さない）。
 * @param key どの記録を見るか
 */
export function distributionByDayBand(points: DayPoint[], key: 'body' | 'focus' | 'mood'): BandRow[] {
  const bands: { label: string; from: number; to: number | null }[] = [
    { label: '0〜6日', from: 0, to: 6 },
    { label: '7〜13日', from: 7, to: 13 },
    { label: '14〜29日', from: 14, to: 29 },
    { label: '30〜89日', from: 30, to: 89 },
    { label: '90日〜', from: 90, to: null },
  ];
  return bands.map((b) => {
    const counts = [0, 0, 0, 0, 0];
    let total = 0;
    for (const p of points) {
      if (p.days == null) continue;
      if (p.days < b.from) continue;
      if (b.to != null && p.days > b.to) continue;
      const v = p[key];
      if (v == null) continue;
      counts[v - 1] += 1;
      total += 1;
    }
    return { ...b, counts, total };
  });
}

/** 緊急ボタンを押した回数（時間帯別）。衝動の波がいつ来るかを見るためだけ */
export function urgesByBand(state: AppState): CountRow[] {
  const rows: CountRow[] = TIME_BANDS.map((b) => ({ id: b.id, label: b.label, count: 0 }));
  for (const u of state.urges) {
    const row = rows.find((x) => x.id === bandOf(u.at));
    if (row) row.count += 1;
  }
  return rows;
}

/** 直近◯日の記録の埋まり具合（責めないための「見える化」だけ） */
export function filledDays(state: AppState, now: number, windowDays = 14): { filled: number; total: number } {
  let filled = 0;
  for (let i = 0; i < windowDays; i++) {
    const key = toKey(new Date(now - i * DAY_MS));
    const d = state.days[key];
    if (d && (d.body != null || d.focus != null || d.mood != null || d.journal.trim().length > 0)) filled += 1;
  }
  return { filled, total: windowDays };
}

/** 過去のリラプスの日数だけを取り出す（グラフ用） */
export function pastStreakDays(state: AppState, now: number): number[] {
  const past = [...state.relapses].sort((a, b) => a.at - b.at).map(relapseDays);
  if (state.startedAt != null) past.push(currentDays(state.startedAt, now));
  return past;
}
