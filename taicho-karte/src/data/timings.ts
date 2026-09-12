import type { TimingId } from '../types/index.js';

export interface TimingDef {
  id: TimingId;
  label: string;
}

/** 発生タイミング。'other' は自由記述を添える */
export const TIMINGS: readonly TimingDef[] = [
  { id: 'during_treatment', label: '施術中' },
  { id: 'after_treatment', label: '施術後' },
  { id: 'waking', label: '起床時' },
  { id: 'working', label: '勤務中' },
  { id: 'other', label: 'その他' },
];

export function timingLabel(id: TimingId, other: string): string {
  const def = TIMINGS.find((t) => t.id === id);
  if (!def) return id;
  if (id === 'other' && other.trim()) return `その他（${other.trim()}）`;
  return def.label;
}
