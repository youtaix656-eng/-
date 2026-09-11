// チャクラレベル（7段階）の判定。
//
// ⚠ 境界日数はアプリが勝手に決めた**目安**で、伝統にも医学にも根拠は無い。
//    だから設定から変えられるようにしてある（`settings.levelThresholds`）。
//    画面では必ず「目安」と書き、日数が進んだことに効果を結びつけない。

import { CHAKRAS, DEFAULT_THRESHOLDS, type Chakra } from '../data/chakras.js';

/** 壊れた設定でも落ちないように整える（昇順・7個・先頭は0） */
export function normalizeThresholds(input: unknown): number[] {
  const arr = Array.isArray(input) ? input.filter((n) => typeof n === 'number' && isFinite(n) && n >= 0) : [];
  const list = arr.length === CHAKRAS.length ? [...arr] : [...DEFAULT_THRESHOLDS];
  list.sort((a, b) => a - b);
  list[0] = 0;
  // 同じ数字が並ぶと「上がったのに同じレベル」に見えるので、必ず1日ずつ離す
  for (let i = 1; i < list.length; i++) {
    if (list[i] <= list[i - 1]) list[i] = list[i - 1] + 1;
  }
  return list.map((n) => Math.round(n));
}

export function levelFor(days: number, thresholds: number[]): number {
  const list = normalizeThresholds(thresholds);
  let level = 1;
  for (let i = 0; i < list.length; i++) {
    if (days >= list[i]) level = i + 1;
  }
  return level;
}

export function chakraFor(days: number, thresholds: number[]): Chakra {
  return CHAKRAS[levelFor(days, thresholds) - 1];
}

export interface NextLevel {
  chakra: Chakra;
  /** あと何日で届くか */
  daysLeft: number;
  /** 0〜1。いまの段の中でどこまで来たか */
  progress: number;
}

/** 次の段（最上段なら null） */
export function nextLevel(days: number, thresholds: number[]): NextLevel | null {
  const list = normalizeThresholds(thresholds);
  const level = levelFor(days, list);
  if (level >= CHAKRAS.length) return null;
  const from = list[level - 1];
  const to = list[level];
  const span = Math.max(1, to - from);
  return {
    chakra: CHAKRAS[level],
    daysLeft: Math.max(0, to - days),
    progress: Math.min(1, Math.max(0, (days - from) / span)),
  };
}
