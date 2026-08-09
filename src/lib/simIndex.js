// 軽量類似度インデックス（#6）— 概念ベクトル(IDF重み)で問題どうしの意味的近さを測る。
//   外部ライブラリなし。単一タグ一致より広く「関連しそうな問題」を出せる。

import { conceptsOf } from './concepts.js';

// 問題群から TF-IDF ベクトル（概念→重み）と df を構築。
export function buildIndex(questions, links = {}) {
  const df = new Map();
  const docs = [];
  for (const q of questions) {
    const cs = conceptsOf(q, links);
    if (cs.length === 0) continue;
    const uniq = [...new Set(cs)];
    uniq.forEach((c) => df.set(c, (df.get(c) || 0) + 1));
    docs.push({ id: q.id, subject: q.subject, concepts: uniq, q });
  }
  const N = docs.length || 1;
  for (const d of docs) {
    const vec = new Map();
    for (const c of d.concepts) {
      const idf = Math.log((N + 1) / ((df.get(c) || 0) + 1)) + 1;
      vec.set(c, idf); // tf は概念集合なので 1
    }
    d.vec = vec;
    d.norm = Math.sqrt([...vec.values()].reduce((s, w) => s + w * w, 0)) || 1;
  }
  return { df, docs, byId: new Map(docs.map((d) => [d.id, d])) };
}

export function cosine(a, b) {
  let dot = 0;
  const [small, large] = a.vec.size < b.vec.size ? [a, b] : [b, a];
  for (const [c, w] of small.vec) if (large.vec.has(c)) dot += w * large.vec.get(c);
  return dot / (a.norm * b.norm);
}

// 指定問題に意味的に近い問題（上位n）。[{ id, subject, sim }]
export function similar(index, id, { limit = 6, minSim = 0.05 } = {}) {
  const base = index.byId.get(id);
  if (!base) return [];
  const rows = [];
  for (const d of index.docs) {
    if (d.id === id) continue;
    const sim = cosine(base, d);
    if (sim >= minSim) rows.push({ id: d.id, subject: d.subject, sim, q: d.q });
  }
  rows.sort((a, b) => b.sim - a.sim);
  return rows.slice(0, limit);
}
