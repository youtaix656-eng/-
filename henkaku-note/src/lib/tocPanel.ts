// 用語をタップした時に出すパネルの中身。
//
// 画面（TocView.tsx）に判断を書かず、ここで組み立てる
// （React を入れていない状態でも試験できるようにするため）。

import type { Destination, DestinationType, TocEntry } from '../data/toc.js';
import { TOC_CATEGORY_MAP } from '../data/toc.js';

/** 説明が空の時に出す文 */
export const NO_DESCRIPTION = '※説明未登録';
/** 飛び先が無い時に出す文 */
export const NO_DESTINATIONS = '関連する飛び先はありません';
/** 確かめきれていない説明に必ず付ける印 */
export const NEEDS_REVIEW_BADGE = '※要確認';

export const DESTINATION_TYPE_LABELS: Record<DestinationType, string> = {
  page: '画面',
  question: '答える項目',
  function: '記録する機能',
  system: 'アプリの決まり',
};

export const DESTINATION_TYPE_ICONS: Record<DestinationType, string> = {
  page: '📱',
  question: '❓',
  function: '🧩',
  system: '📌',
};

export interface PanelDestination extends Destination {
  typeLabel: string;
  typeIcon: string;
}

export interface PanelModel {
  id: string;
  title: string;
  reading: string;
  categoryLabel: string;
  categoryIcon: string;
  /** 画面に出す説明（空なら NO_DESCRIPTION が入る） */
  description: string;
  /** 説明が登録されていない（＝プレースホルダを出している） */
  descriptionMissing: boolean;
  /** 「※要確認」を出すか。**needs_review なら必ず true** */
  showNeedsReview: boolean;
  aliases: string[];
  destinations: PanelDestination[];
  /** 飛び先が無い（＝ボタンの並びを出さない） */
  destinationsEmpty: boolean;
  destinationsNote: string;
}

/** 同じ飛び先が2つ並ばないようにする（カテゴリの既定と項目ごとの指定が重なるため） */
function dedupe(list: Destination[]): Destination[] {
  const seen = new Set<string>();
  const out: Destination[] = [];
  for (const d of list) {
    const k = `${d.view}#${d.anchor}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  return out;
}

export function buildPanel(entry: TocEntry): PanelModel {
  const cat = TOC_CATEGORY_MAP[entry.category];
  const text = String(entry.description || '').trim();
  const destinations = dedupe(entry.destinations).map((d) => ({
    ...d,
    typeLabel: DESTINATION_TYPE_LABELS[d.type],
    typeIcon: DESTINATION_TYPE_ICONS[d.type],
  }));
  return {
    id: entry.id,
    title: entry.title,
    reading: entry.reading || '',
    categoryLabel: cat?.label || entry.category,
    categoryIcon: cat?.icon || '•',
    description: text || NO_DESCRIPTION,
    descriptionMissing: text.length === 0,
    showNeedsReview: entry.descriptionStatus === 'needs_review',
    aliases: [...entry.aliases],
    destinations,
    destinationsEmpty: destinations.length === 0,
    destinationsNote: destinations.length === 0 ? NO_DESTINATIONS : '',
  };
}
