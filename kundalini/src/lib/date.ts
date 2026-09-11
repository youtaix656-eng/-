// 日付の扱い。
// ⚠ toISOString() と new Date('YYYY-MM-DD') を使わない
//    （どちらもUTCとして扱われるので、日本時間の午前0時が前日になる）。
//    文字列は自分で組み立て、読むときも数値に割って new Date(y, m-1, d) を使う。

import type { DateKey } from '../types/index.js';

export const DAY_MS = 86400000;

function pad(n: number): string {
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

/** その日の午前0時（ローカル）の epoch ms */
export function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** a→b の日数差（カレンダー上の日付の差。時刻は見ない） */
export function daysBetweenKeys(a: DateKey, b: DateKey): number {
  const da = fromKey(a).getTime();
  const db = fromKey(b).getTime();
  return Math.round((startOfDay(db) - startOfDay(da)) / DAY_MS);
}

export function addDaysKey(key: DateKey, delta: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return toKey(d);
}

/** 'HH:MM' */
export function hhmm(at: number): string {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${hhmm(at)}`;
}

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 時間帯（0-5 / 6-11 / 12-17 / 18-23）の区分 */
export const TIME_BANDS = [
  { id: 'night', label: '深夜 0-5時', from: 0, to: 5 },
  { id: 'morning', label: '午前 6-11時', from: 6, to: 11 },
  { id: 'afternoon', label: '午後 12-17時', from: 12, to: 17 },
  { id: 'evening', label: '夜 18-23時', from: 18, to: 23 },
];

export function bandOf(at: number): string {
  const h = new Date(at).getHours();
  const band = TIME_BANDS.find((b) => h >= b.from && h <= b.to);
  return band ? band.id : 'night';
}

/** 経過時間を「◯日 ◯時間 ◯分」で表す（秒は出さない＝落ち着かなくなるため） */
export function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}日 ${hours}時間 ${minutes}分`;
  if (hours > 0) return `${hours}時間 ${minutes}分`;
  return `${minutes}分`;
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
