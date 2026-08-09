// 関連問題グラフ（#13）— 共有タグの多さで「関連する問題」を返す純粋関数。
//   同じ論点・近い論点の問題をまとめて演習する導線に使う。

import { effectiveTags } from './query.js';

// target と多くタグを共有する問題を、共有数の多い順に返す。
//   [{ id, question, shared, sharedTags }]（自分自身は除外）
export function relatedQuestions(target, questions, links = {}, { limit = 8, sameSubject = false } = {}) {
  if (!target) return [];
  const tset = new Set(effectiveTags(target, links));
  if (tset.size === 0) return [];
  const rows = [];
  for (const q of questions) {
    if (q.id === target.id) continue;
    if (sameSubject && q.subject !== target.subject) continue;
    const shared = [];
    for (const t of effectiveTags(q, links)) if (tset.has(t)) shared.push(t);
    if (shared.length) rows.push({ id: q.id, question: q, shared: shared.length, sharedTags: shared });
  }
  rows.sort((a, b) => b.shared - a.shared);
  return limit > 0 ? rows.slice(0, limit) : rows;
}
