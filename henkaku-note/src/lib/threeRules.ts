// 3のルール（今日・今週・今月に3つずつ書き出して実践する）。
//
// 出典: 『最高の体調』の解説要約。「やるべきことがぼんやりしたままだと不安やストレスを感じる」
// ため、未来を細かく刻んで今との距離を近づける、という考え方。
//
// 日・週・月で**同じ仕組み**を使う（3か所に別の実装を持たない）。
// 既存機能との関係:
//   今日の3つ … これまでの「今日の宣言」（一文）を置き換える。二重に書かせない。
//   今週の3つ … 先週の週次振り返りの「来週集中すべきこと」を引き継ぎ候補として出す。
//   今月の3つ … 実践期間の「最上位目標1つ」とは層が違う（目標1つ ≠ 今月やり遂げる3つ）。

import { startOfWeek } from './date.js';

export type Scope = 'day' | 'week' | 'month';
export const SCOPES: { id: Scope; label: string; lead: string }[] = [
  { id: 'day', label: '今日', lead: '毎朝3つ書き出して、目の前に置いておく' },
  { id: 'week', label: '今週', lead: '週の頭に3つ' },
  { id: 'month', label: '今月', lead: '月初めに3つ' },
];

export const SLOTS = 3;
export const ITEM_MAX = 60;

/** 保存キー。日・週・月を1つの表で持つ */
export function keyFor(scope: Scope, date: string): string {
  if (scope === 'day') return date;
  if (scope === 'week') return `w:${startOfWeek(date)}`;
  return `m:${date.slice(0, 7)}`;
}

/** 常に3枠に整える（足りなければ空文字、多ければ切る） */
export function normalizeThree(list: string[] | undefined): string[] {
  const base = (list ?? []).map((s) => String(s ?? '').slice(0, ITEM_MAX));
  while (base.length < SLOTS) base.push('');
  return base.slice(0, SLOTS);
}

export function getThree(store: Record<string, string[]> | undefined, scope: Scope, date: string): string[] {
  return normalizeThree(store?.[keyFor(scope, date)]);
}

/** 1つでも書けていれば「書いた」とみなす（3つ埋めることを条件にしない） */
export function isWritten(list: string[] | undefined): boolean {
  return normalizeThree(list).some((s) => s.trim().length > 0);
}

export function filledCount(list: string[] | undefined): number {
  return normalizeThree(list).filter((s) => s.trim().length > 0).length;
}

/** 期間内に「今日の3つ」を書けた日数 */
export function writtenDays(store: Record<string, string[]> | undefined, dateKeys: string[]): number {
  return dateKeys.filter((k) => isWritten(store?.[keyFor('day', k)])).length;
}

/**
 * 引き継ぎ候補。
 * - 今日 … 今週の3つのうち、まだ今日に入っていないもの
 * - 今週 … 先週の週次振り返りの「来週集中すべきこと」（呼び出し側が渡す）
 * 未来を細かく刻む、という趣旨なので、上の階層から降ろしてくる形にする。
 */
export function carryDown(upper: string[] | undefined, current: string[] | undefined): string[] {
  const cur = normalizeThree(current).map((s) => s.trim()).filter(Boolean);
  return normalizeThree(upper)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !cur.includes(s));
}

/** 空いている枠の番号（引き継ぎを入れる先）。無ければ -1 */
export function firstEmptySlot(list: string[] | undefined): number {
  return normalizeThree(list).findIndex((s) => s.trim().length === 0);
}

/** 週次振り返りの自由記述（改行区切り）を3つに割る。引き継ぎの入口 */
export function splitFocusText(text: string): string[] {
  return String(text || '')
    .split(/\r?\n|、|・/)
    .map((s) => s.replace(/^[-・\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, SLOTS);
}
