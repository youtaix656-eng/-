// 連想リコール生成（#17）＋ 関連1問チェイン選定（#1）— 純粋関数。

import { effectiveStrength } from './assocStrength.js';
import { conceptsOf } from './concepts.js';

// 強いつながりから「A→つながるBを想起」問題を作る。[{ a, b, type, strength }]
export function recallPairs(graph, { limit = 10, now = Date.now() } = {}) {
  const rows = Object.values(graph.edges)
    .map((e) => ({ a: e.a, b: e.b, type: e.type, strength: effectiveStrength(e, now) || e.strength || e.weight || 0 }))
    .filter((e) => e.strength > 0)
    .sort((x, y) => y.strength - x.strength);
  return limit > 0 ? rows.slice(0, limit) : rows;
}

// 関連1問チェイン：直前の問題と最も概念を共有する未出題の1問を選ぶ。
//   excludeIds: すでに出した問題 id の Set。
export function chainNext(current, questions, links = {}, excludeIds = new Set(), { minShared = 1 } = {}) {
  const base = new Set(conceptsOf(current, links));
  if (base.size === 0) return null;
  let best = null;
  let bestShared = 0;
  for (const q of questions) {
    if (q.id === current.id || excludeIds.has(q.id)) continue;
    const cs = conceptsOf(q, links);
    let shared = 0;
    for (const c of cs) if (base.has(c)) shared += 1;
    if (shared >= minShared && shared > bestShared) { best = { question: q, shared }; bestShared = shared; }
  }
  return best;
}

// 概念に対する精緻化候補（#2「これと何がつながる？」）：
//   その概念とつながる隣接概念のうち、まだ現在の問題に付いていない語を提案する。
import { neighbors } from './knowledgeGraph.js';
export function elaborationSuggestions(graph, conceptsOfQuestion, { limit = 6 } = {}) {
  const have = new Set(conceptsOfQuestion);
  const scores = new Map();
  for (const c of conceptsOfQuestion) {
    for (const n of neighbors(graph, c)) {
      if (have.has(n.other)) continue;
      scores.set(n.other, (scores.get(n.other) || 0) + (n.strength || n.weight || 1));
    }
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}
