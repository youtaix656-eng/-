// 概念正規化・オントロジー層（#2）— タグや語を「概念ID」に統一する。
//   表記ゆれ（同義語辞書）を吸収し、知識グラフのノードがぶれないようにする土台。

import { canonical, isGenericTag } from './synonyms.js';
import { effectiveTags } from './query.js';

// 語 → 概念ID（正式名称に寄せる）
export function conceptId(term) {
  return canonical(String(term || '').trim());
}

// 問題 → その問題が表す概念ID一覧（正規化・重複排除・汎用語/1文字を除外）
export function conceptsOf(question, links = {}) {
  const set = new Set();
  for (const raw of effectiveTags(question, links)) {
    const id = conceptId(raw);
    if (!id || id.length <= 1) continue;
    if (isGenericTag(id)) continue;
    set.add(id);
  }
  return [...set];
}
