// 一覧の絞り込みと並び替え（純関数。画面は結果を並べるだけ）。

import type { CareRecord, DateKey, EffectId, SymptomRecord } from '../types/index.js';
import { effectRank } from '../data/effects.js';
import { keyOf } from './date.js';

export interface SymptomFilter {
  /** 部位 id の集合（空なら全部） */
  regionIds?: string[];
  /** 'YYYY-MM-DD' の範囲（両端を含む） */
  from?: DateKey | '';
  to?: DateKey | '';
  /** VAS の下限（この値以上） */
  minVas?: number;
  /** メモ・部位名の部分一致（小文字化して比べる） */
  text?: string;
}

export type SymptomSort = 'newest' | 'oldest' | 'vas_desc';

export function filterSymptoms(list: readonly SymptomRecord[], f: SymptomFilter, regionLabelOf: (id: string) => string): SymptomRecord[] {
  const regions = f.regionIds && f.regionIds.length ? new Set(f.regionIds) : null;
  const text = (f.text ?? '').trim().toLowerCase();
  return list.filter((s) => {
    if (regions && !regions.has(s.regionId)) return false;
    const day = keyOf(s.at);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (typeof f.minVas === 'number' && s.vas < f.minVas) return false;
    if (text) {
      const hay = `${regionLabelOf(s.regionId)} ${s.note} ${s.timingOther}`.toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });
}

export function sortSymptoms(list: readonly SymptomRecord[], sort: SymptomSort): SymptomRecord[] {
  const out = [...list];
  if (sort === 'oldest') out.sort((a, b) => a.at - b.at);
  else if (sort === 'vas_desc') out.sort((a, b) => b.vas - a.vas || b.at - a.at);
  else out.sort((a, b) => b.at - a.at);
  return out;
}

export interface CareFilter {
  effects?: EffectId[];
  symptomId?: string;
  text?: string;
  from?: DateKey | '';
  to?: DateKey | '';
}

/** 'effect' は効果があったものを上位に（同じ効果なら新しい順） */
export type CareSort = 'effect' | 'newest' | 'oldest';

export function filterCares(list: readonly CareRecord[], f: CareFilter): CareRecord[] {
  const effects = f.effects && f.effects.length ? new Set(f.effects) : null;
  const text = (f.text ?? '').trim().toLowerCase();
  return list.filter((c) => {
    if (effects && !effects.has(c.effect)) return false;
    if (f.symptomId && !c.symptomIds.includes(f.symptomId)) return false;
    if (f.from && c.date < f.from) return false;
    if (f.to && c.date > f.to) return false;
    if (text && !c.content.toLowerCase().includes(text)) return false;
    return true;
  });
}

export function sortCares(list: readonly CareRecord[], sort: CareSort): CareRecord[] {
  const out = [...list];
  if (sort === 'effect') out.sort((a, b) => effectRank(b.effect) - effectRank(a.effect) || b.at - a.at);
  else if (sort === 'oldest') out.sort((a, b) => a.at - b.at);
  else out.sort((a, b) => b.at - a.at);
  return out;
}

/** その症状に紐づく対応策 */
export function caresForSymptom(cares: readonly CareRecord[], symptomId: string): CareRecord[] {
  return sortCares(cares.filter((c) => c.symptomIds.includes(symptomId)), 'newest');
}
