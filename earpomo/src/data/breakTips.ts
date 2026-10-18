import type { Phase } from '../types/index.js';

// 休憩の過ごし方の提案。乱数ではなく「何回目の集中か」で順にずらして出す
// （描き直すたびに提案が変わると落ち着かないため）。
export interface BreakTip {
  id: string;
  text: string;
  /** 線画アイコンの種類（components/Icons.tsx の名前） */
  icon: 'eye' | 'drop' | 'walk' | 'stretch' | 'note' | 'breath' | 'window' | 'shoulder';
}

export const SHORT_BREAK_TIPS: BreakTip[] = [
  { id: 'far', text: '遠くを20秒見る', icon: 'eye' },
  { id: 'water', text: '水を一口飲む', icon: 'drop' },
  { id: 'shoulder', text: '肩をゆっくり回す', icon: 'shoulder' },
  { id: 'breath', text: '深く3回呼吸する', icon: 'breath' },
  { id: 'close', text: '目を閉じて何も見ない', icon: 'eye' },
];

export const LONG_BREAK_TIPS: BreakTip[] = [
  { id: 'walk', text: '軽く立って歩く', icon: 'walk' },
  { id: 'stretch', text: '腰まわりを伸ばす', icon: 'stretch' },
  { id: 'memo', text: '一言メモを残す', icon: 'note' },
  { id: 'window', text: '窓を開けて空気を入れ替える', icon: 'window' },
  { id: 'water', text: 'コップ一杯の水を飲む', icon: 'drop' },
];

export const TIPS_PER_BREAK = 2;

/** 何回目の集中のあとか（pomoIndex）で、順にずらした提案を返す */
export function tipsFor(phase: Phase, pomoIndex: number, count = TIPS_PER_BREAK): BreakTip[] {
  const pool = phase === 'long' ? LONG_BREAK_TIPS : SHORT_BREAK_TIPS;
  const start = ((pomoIndex % pool.length) + pool.length) % pool.length;
  const out: BreakTip[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    out.push(pool[(start + i) % pool.length]);
  }
  return out;
}
