// 連結推薦エンジン（#10）— 次に解くと「新しいつながり」が最も生まれる問題を選ぶ。
//   既知の概念に橋渡し（bridge）しつつ、新しい概念（new）も足す問題を高評価。純粋関数。

import { conceptsOf } from './concepts.js';

// graph: 既知の知識グラフ / questions: 全問題 / solved: 解答済みidのSet
//   [{ id, question, bridges:[既知概念], adds:[新概念], score }]
export function recommendNext(graph, questions, solved, links = {}, { limit = 8 } = {}) {
  const known = new Set(Object.keys(graph.nodes || {}));
  const rows = [];
  for (const q of questions) {
    if (solved.has(q.id)) continue;
    const cs = conceptsOf(q, links);
    if (cs.length === 0) continue;
    const bridges = cs.filter((c) => known.has(c));
    const adds = cs.filter((c) => !known.has(c));
    if (bridges.length === 0 || adds.length === 0) continue; // 既知にも繋がり、かつ新しさもある
    const score = bridges.length * (1 + adds.length);
    rows.push({ id: q.id, question: q, bridges, adds, score });
  }
  rows.sort((a, b) => b.score - a.score);
  return limit > 0 ? rows.slice(0, limit) : rows;
}
