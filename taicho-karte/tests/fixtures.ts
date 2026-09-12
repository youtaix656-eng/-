// テスト用の共通の材料。
import type { CareRecord, SymptomRecord } from '../src/types/index.js';

export const DAY = 86400000;
export const NOW = new Date(2026, 8, 12, 12, 0, 0).getTime();

export function symptom(over: Partial<SymptomRecord> = {}): SymptomRecord {
  return {
    id: over.id ?? `s-${over.at ?? NOW}`,
    at: NOW,
    regionId: 'lower_back',
    side: null,
    vas: 5,
    timing: 'working',
    timingOther: '',
    note: '',
    ...over,
  };
}

export function care(over: Partial<CareRecord> = {}): CareRecord {
  return {
    id: over.id ?? `c-${over.at ?? NOW}`,
    date: '2026-09-12',
    at: NOW,
    content: 'ストレッチ',
    effect: 'same',
    symptomIds: [],
    ...over,
  };
}
