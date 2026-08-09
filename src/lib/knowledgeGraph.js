// 知識グラフ・ストア（#1）— ノード＝概念、エッジ＝関係(重み付き)。
//   解答のたびに成長する自分専用の知識マップ。IndexedDB に永続化する。
//   純粋な操作関数＋読み書きヘルパーで構成し、他モジュール（共起・強度・推薦）から使う。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:kgraph';

// 空グラフ。nodes/edges は JSON 化しやすいプレーンオブジェクト。
export function emptyGraph() {
  return { nodes: {}, edges: {}, v: 1 };
}

// エッジのキー（無向：a,b をソート。type ごとに別エッジ）
export function edgeKey(a, b, type = 'coOccurs') {
  return a < b ? `${a}${b}${type}` : `${b}${a}${type}`;
}

// ノードを追加/更新（出現回数・科目を集約）。破壊的（builder 用に高速）。
export function addNode(g, id, { subject } = {}) {
  if (!id) return g;
  const n = g.nodes[id] || { id, count: 0, subjects: [] };
  n.count += 1;
  if (subject && !n.subjects.includes(subject)) n.subjects.push(subject);
  g.nodes[id] = n;
  return g;
}

// エッジを追加/強化。weight を加算し、co（共起回数）を数える。
export function addEdge(g, a, b, { type = 'coOccurs', weight = 1 } = {}) {
  if (!a || !b || a === b) return g;
  const k = edgeKey(a, b, type);
  const e = g.edges[k] || { a: a < b ? a : b, b: a < b ? b : a, type, weight: 0, co: 0, strength: 0 };
  e.weight += weight;
  e.co += 1;
  g.edges[k] = e;
  return g;
}

// 概念集合（1問など）から全ペアを共起エッジとして追加
export function addCoOccurrence(g, concepts, { subject } = {}) {
  const ids = [...new Set(concepts)].filter(Boolean);
  ids.forEach((id) => addNode(g, id, { subject }));
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) addEdge(g, ids[i], ids[j], { type: 'coOccurs' });
  }
  return g;
}

// あるノードに隣接するエッジ（重い順）
export function neighbors(g, id) {
  const out = [];
  for (const e of Object.values(g.edges)) {
    if (e.a === id) out.push({ other: e.b, ...e });
    else if (e.b === id) out.push({ other: e.a, ...e });
  }
  return out.sort((x, y) => (y.strength || y.weight) - (x.strength || x.weight));
}

export function graphStats(g) {
  return { nodes: Object.keys(g.nodes).length, edges: Object.keys(g.edges).length };
}

// ---- 永続化 ----
export async function loadGraph() {
  try { return (await idbGet(KEY)) || emptyGraph(); } catch (e) { return emptyGraph(); }
}
export async function saveGraph(g) {
  try { await idbSet(KEY, g); } catch (e) { /* noop */ }
}
