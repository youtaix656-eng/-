// 日付の扱い。
// ⚠ toISOString() と new Date('YYYY-MM-DD') を使わない
//    （どちらもUTCとして扱われるので、日本時間の午前0時が前日になる）。

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

export function keyOf(at: number): DateKey {
  return toKey(new Date(at));
}

export function isDateKey(s: unknown): s is DateKey {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function addDaysKey(key: DateKey, delta: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return toKey(d);
}

export function hhmm(at: number): string {
  const d = new Date(at);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(key: DateKey): string {
  const [y, m, d] = key.split('-');
  return `${y}/${m}/${d}`;
}

export function formatDateTime(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${hhmm(at)}`;
}
