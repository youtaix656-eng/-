import type { Preset } from '../types/index.js';

// 最初から入っているプリセット（設計書の例のまま）。編集・追加・削除できる。
export const DEFAULT_PRESETS: Preset[] = [
  { id: 'study-25', name: '勉強用 25/5/15', focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsCount: 4 },
  { id: 'study-10', name: '勉強用 10/3/30', focusMinutes: 10, shortBreakMinutes: 3, longBreakMinutes: 30, sessionsCount: 4 },
  { id: 'work-50', name: '作業用 50/10/20', focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20, sessionsCount: 3 },
];

/** 時間設定の範囲（分・回） */
export const LIMITS = {
  focusMinutes: { min: 1, max: 180 },
  shortBreakMinutes: { min: 1, max: 60 },
  longBreakMinutes: { min: 1, max: 120 },
  sessionsCount: { min: 1, max: 12 },
} as const;
