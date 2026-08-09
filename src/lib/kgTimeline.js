// 知識グラフの成長タイムラプス（#14）＋ 疾患3点セット（#5）— 純粋関数。

import { conceptsOf } from './concepts.js';
import { neighbors } from './knowledgeGraph.js';
import authoredRelations from '../data/relations.js';
import { conceptId } from './concepts.js';

// 直近 days 日で「累積の概念数」がどう増えたか。[{ label, cumulative, added }]
export function conceptGrowth(history, questions, links = {}, { days = 14, now = Date.now() } = {}) {
  const DAY = 86400000;
  const byId = new Map(questions.map((q) => [q.id, q]));
  // 日付ごとに、その日新しく登場した概念を数える
  const base = new Date(now); base.setHours(0, 0, 0, 0);
  const seen = new Set();
  // まず days より前に既に見た概念を seen に入れる（累積の起点）
  const startMs = base.getTime() - (days - 1) * DAY;
  for (const h of history) {
    if (h.at >= startMs) continue;
    const q = byId.get(h.questionId);
    if (q) for (const c of conceptsOf(q, links)) seen.add(c);
  }
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d0 = base.getTime() - i * DAY;
    const d1 = d0 + DAY;
    let added = 0;
    for (const h of history) {
      if (h.at < d0 || h.at >= d1) continue;
      const q = byId.get(h.questionId);
      if (!q) continue;
      for (const c of conceptsOf(q, links)) if (!seen.has(c)) { seen.add(c); added += 1; }
    }
    const d = new Date(d0);
    out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, added, cumulative: seen.size });
  }
  return out;
}

// 疾患3点セット（#5）：ある疾患概念の「原因・治療・関連」をまとめる。
//   authored relations（causes/treats）＋ グラフの隣接から集める。
export function diseaseTriad(concept, graph, { limit = 5 } = {}) {
  const id = conceptId(concept);
  const causes = [];
  const treats = [];
  for (const r of authoredRelations) {
    const a = conceptId(r.from);
    const b = conceptId(r.to);
    if (b === id && r.type === 'causes') causes.push(a); // a が原因
    if (a === id && r.type === 'causes') causes.push(b);
    if (b === id && r.type === 'treats') treats.push(a); // a が治療
    if (a === id && r.type === 'treats') treats.push(b);
  }
  const related = (graph ? neighbors(graph, id) : [])
    .map((n) => n.other)
    .filter((x) => !causes.includes(x) && !treats.includes(x))
    .slice(0, limit);
  return {
    causes: [...new Set(causes)].slice(0, limit),
    treats: [...new Set(treats)].slice(0, limit),
    related,
  };
}
