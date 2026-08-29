// 目次（あ〜ん / A〜Z 索引）— **各データから自動生成する。書き写さない**。
//
// 共通ルール（全アプリ）:
//   1. 並びは「あ〜ん」→「A〜Z」。読み（ひらがな）で並べ替える。
//   2. 数字も読み方で振り分ける（yomi.js の autoReading）。
//   3. 漢字の読みは推定しない。読みが無ければ「その他」に落として入れ忘れを見せる。
//   4. タイトルは重複させない（toc.test.mjs が機械チェックする）。

import { HACKS } from './hacks.js';
import { CATEGORIES, CATEGORY_MAP } from './schema.js';
import { buildKanaIndex } from '../lib/yomi.js';

/** 目次に載せる項目（ライフハック本体＋カテゴリ） */
export function tocItems() {
  const items = HACKS.map((hack) => ({
    id: hack.id,
    title: hack.title,
    reading: hack.reading,
    kind: 'hack',
    category: hack.category,
    sub: CATEGORY_MAP[hack.category] ? CATEGORY_MAP[hack.category].label : '',
  }));
  for (const category of CATEGORIES) {
    items.push({
      id: `category:${category.id}`,
      title: category.label,
      reading: category.reading,
      kind: 'category',
      category: category.id,
      sub: 'カテゴリ',
    });
  }
  return items;
}

/** あ〜ん / A〜Z のセクション（空の行は含まない） */
export function tocSections(items = tocItems()) {
  return buildKanaIndex(items);
}
