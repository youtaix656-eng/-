// 知識グラフのオーケストレーション＋連結イベントログ（#10）。
//   解いた問題群から共起・関係・PMIを合成して1つのグラフを組み立て、
//   連結の生成/強化を追記ログに残す。ビュー側はこれ1本でグラフを得られる。

import { emptyGraph, addCoOccurrence, addEdge, addNode } from './knowledgeGraph.js';
import { conceptId, conceptsOf } from './concepts.js';
import { applyPmiStrength } from './coOccur.js';
import authoredRelations from '../data/relations.js';
import { idbGet, idbSet } from './db.js';

const LOG_KEY = 'shinkyu:kglog';
const LOG_MAX = 500;

// 解答済み問題群から知識グラフを構築（共起＋作者の関係＋PMI強度）。
//   solvedQuestions: 解答済みの問題配列 / links: 連結学習
export function buildGraphFromSolved(solvedQuestions, links = {}) {
  const g = emptyGraph();
  const docs = [];
  for (const q of solvedQuestions) {
    const cs = conceptsOf(q, links);
    if (cs.length === 0) continue;
    addCoOccurrence(g, cs, { subject: q.subject });
    docs.push(cs);
  }
  // 作者が定義した型付き関係（両端がグラフに在るものだけ強い辺として追加）
  for (const r of authoredRelations) {
    const a = conceptId(r.from);
    const b = conceptId(r.to);
    if (g.nodes[a] && g.nodes[b]) {
      addNode(g, a); addNode(g, b);
      addEdge(g, a, b, { type: r.type, weight: 3 });
    }
  }
  // PMI で共起辺の強さを補正
  applyPmiStrength(g, docs);
  return g;
}

// 「今日つないだ知識」：今日解いた問題の概念どうしの共起ペア（重複排除）。
export function todaysLinks(questionsAnsweredToday, links = {}, { limit = 12 } = {}) {
  const seen = new Set();
  const out = [];
  for (const q of questionsAnsweredToday) {
    const cs = conceptsOf(q, links);
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++) {
        const k = cs[i] < cs[j] ? `${cs[i]}|${cs[j]}` : `${cs[j]}|${cs[i]}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ a: cs[i], b: cs[j] });
        if (out.length >= limit) return out;
      }
  }
  return out;
}

// ---- 連結イベントログ（追記型） ----
export async function logLinkEvents(events) {
  if (!events || !events.length) return;
  try {
    const list = (await idbGet(LOG_KEY)) || [];
    const stamped = events.map((e) => ({ ...e, at: Date.now() }));
    await idbSet(LOG_KEY, [...stamped, ...list].slice(0, LOG_MAX));
  } catch (e) { /* noop */ }
}
export async function loadLinkLog() {
  try { return (await idbGet(LOG_KEY)) || []; } catch (e) { return []; }
}
