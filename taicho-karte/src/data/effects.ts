import type { EffectId } from '../types/index.js';

export interface EffectDef {
  id: EffectId;
  label: string;
  /** 並び替え用の順位（大きいほど効いた）。画面には出さない＝点数にしない */
  rank: number;
  /** 一覧に出す短い印 */
  mark: string;
}

/** 効果の自己評価（4段階） */
export const EFFECTS: readonly EffectDef[] = [
  { id: 'worse', label: '悪化', rank: 0, mark: '▼' },
  { id: 'same', label: '変化なし', rank: 1, mark: '－' },
  { id: 'better', label: '軽減', rank: 2, mark: '▲' },
  { id: 'much_better', label: '大幅改善', rank: 3, mark: '▲▲' },
];

export function effectDef(id: EffectId): EffectDef {
  return EFFECTS.find((e) => e.id === id) ?? EFFECTS[1];
}

export function effectRank(id: EffectId): number {
  return effectDef(id).rank;
}
