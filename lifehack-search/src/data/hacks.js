// 全ライフハックの集約 — 画面と検索はここだけを見る。
// **一覧を書き写さない**（データファイルを足したら import を1行足すだけ）。

import { TIME_HACKS } from './hacksTime.js';
import { BODY_HACKS } from './hacksBody.js';
import { LIFE_HACKS } from './hacksLife.js';
import { WORK_HACKS } from './hacksWork.js';
import { CATEGORY_MAP } from './schema.js';

export const HACKS = [...TIME_HACKS, ...BODY_HACKS, ...LIFE_HACKS, ...WORK_HACKS];

export const HACK_MAP = Object.fromEntries(HACKS.map((h) => [h.id, h]));

/** 1件取り出す（無ければ null。画面で「見つかりません」を出すため） */
export function hackById(id) {
  return HACK_MAP[id] || null;
}

/** カテゴリごとの件数（絞り込みの表示用。0件のカテゴリも返す＝手薄が見える） */
export function countByCategory(hacks = HACKS) {
  const counts = {};
  for (const id of Object.keys(CATEGORY_MAP)) counts[id] = 0;
  for (const hack of hacks) counts[hack.category] = (counts[hack.category] || 0) + 1;
  return counts;
}

/** よく使われているタグ（多い順）。検索の入口に出す */
export function popularTags(hacks = HACKS, limit = 24) {
  const counts = new Map();
  for (const hack of hacks) for (const tag of hack.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
  // 多い順。同じ件数のときはデータに書いた順のまま（読みを持たない語を五十音で並べると、
  // 数字で始まる語が先頭に固まって「数字も読みで振り分ける」共通ルールと食い違って見える）
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

/** 困りごと（situations）の一覧。「こういう時」から引く入口に使う */
export function allSituations(hacks = HACKS) {
  const counts = new Map();
  for (const hack of hacks) for (const s of hack.situations || []) counts.set(s, (counts.get(s) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([text, count]) => ({ text, count }));
}

/**
 * 「今日の1つ」— 日付から決める（毎回変わると、見比べも共有もできないため）。
 * 乱数を使わないので、同じ日に開けば同じものが出る。
 */
export function hackOfTheDay(hacks = HACKS, date = new Date()) {
  // dailyPick:false の項目は「試す工夫」ではないので勧めない（例：受診をすすめる項目）
  const pool = hacks.filter((h) => h.dailyPick !== false);
  if (pool.length === 0) return null;
  const key = Number(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`);
  return pool[key % pool.length];
}
