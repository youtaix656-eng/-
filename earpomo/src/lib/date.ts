// 日付の扱い。
// ⚠ toISOString() と new Date('YYYY-MM-DD') を使わない
//    （どちらもUTCとして扱われるので、日本時間の午前0時が前日になる）。

import type { DateKey, TimeKey } from '../types/index.js';

export const DAY_MS = 86400000;

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map((v) => Number(v));
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayKey(now: number = Date.now()): DateKey {
  return toKey(new Date(now));
}

export function isValidKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = fromKey(key);
  return toKey(d) === key;
}

export function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** a→b の日数差（カレンダー上の日付の差。時刻は見ない） */
export function daysBetweenKeys(a: DateKey, b: DateKey): number {
  return Math.round((startOfDay(fromKey(b).getTime()) - startOfDay(fromKey(a).getTime())) / DAY_MS);
}

export function addDaysKey(key: DateKey, delta: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return toKey(d);
}

/** 0=日 … 6=土 */
export function weekdayOf(key: DateKey): number {
  return fromKey(key).getDay();
}

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** その週の月曜（週の始まりは月曜） */
export function startOfWeekKey(key: DateKey): DateKey {
  const wd = weekdayOf(key);
  const back = (wd + 6) % 7;
  return addDaysKey(key, -back);
}

/** その月の1日 */
export function startOfMonthKey(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

export function hhmm(at: number): TimeKey {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isValidTime(t: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/** 'HH:mm' → 分 */
export function timeToMinutes(t: TimeKey): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function mmss(totalMs: number): string {
  const s = Math.max(0, Math.ceil(totalMs / 1000));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/** 分 → 「1時間30分」 */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0 && r > 0) return `${h}時間${r}分`;
  if (h > 0) return `${h}時間`;
  return `${r}分`;
}

/** 分 → 'H:MM'（記録画面の大きな数字。単位の h は画面側で添える） */
export function formatHm(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${pad(m % 60)}`;
}

/** 分 → '1h30m'／'45m'（一覧・内訳の短い表記） */
export function formatShort(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0) return `${h}h${pad(r)}m`;
  return `${r}m`;
}

/** 'YYYY-MM-DD' → 'M/D' */
export function shortDate(key: DateKey): string {
  const d = fromKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function longDate(key: DateKey): string {
  const d = fromKey(key);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}
