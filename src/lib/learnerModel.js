// 学習者知識状態モデル（#9）— 概念ごとの習得度と、孤立した知識（浮いた点）を検出する。
//   未習得・つながっていない概念を洗い出し、結び先を提案する土台。

import { conceptsOf } from './concepts.js';
import { isMastered } from './srs.js';

// 各ノードの次数（つながりの本数）
export function nodeDegrees(graph) {
  const deg = new Map();
  for (const id of Object.keys(graph.nodes)) deg.set(id, 0);
  for (const e of Object.values(graph.edges)) {
    deg.set(e.a, (deg.get(e.a) || 0) + 1);
    deg.set(e.b, (deg.get(e.b) || 0) + 1);
  }
  return deg;
}

// 孤立した知識（次数が maxDegree 以下）。[{ id, degree, count }]（弱いつながり順）
export function isolatedConcepts(graph, { maxDegree = 1, limit = 20 } = {}) {
  const deg = nodeDegrees(graph);
  const rows = [];
  for (const [id, d] of deg) {
    if (d <= maxDegree) rows.push({ id, degree: d, count: graph.nodes[id]?.count || 0 });
  }
  rows.sort((a, b) => a.degree - b.degree || b.count - a.count);
  return limit > 0 ? rows.slice(0, limit) : rows;
}

// 概念ごとの習得度：その概念を含む問題のうち何割がマスター済みか。
//   Map(concept -> { total, mastered, ratio })
export function conceptMasteryMap(questions, srs, links = {}) {
  const map = new Map();
  for (const q of questions) {
    const done = isMastered(srs[q.id]);
    for (const c of conceptsOf(q, links)) {
      const cur = map.get(c) || { total: 0, mastered: 0, ratio: 0 };
      cur.total += 1;
      if (done) cur.mastered += 1;
      cur.ratio = cur.mastered / cur.total;
      map.set(c, cur);
    }
  }
  return map;
}

// 「未習得なのに孤立している」＝つなげると効く概念を優先度順に返す。
export function connectionSuggestions(graph, questions, srs, links = {}, { limit = 10 } = {}) {
  const iso = isolatedConcepts(graph, { maxDegree: 1, limit: 0 });
  const mastery = conceptMasteryMap(questions, srs, links);
  const rows = iso.map((n) => ({
    id: n.id,
    degree: n.degree,
    mastery: mastery.get(n.id)?.ratio ?? 0,
  }));
  // つながりが少なく、かつ未習得（mastery 低い）ほど優先
  rows.sort((a, b) => a.degree - b.degree || a.mastery - b.mastery);
  return limit > 0 ? rows.slice(0, limit) : rows;
}
