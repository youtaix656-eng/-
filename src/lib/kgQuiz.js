// 連想クイズ生成（#23 経路クイズ / #24 束グルーピング）— 純粋関数。
//   知識グラフから「AとBをつなぐ中間概念は？」「仲間はどれ？」の問題を作る。

import { neighbors } from './knowledgeGraph.js';
import { connectedComponents } from './graphAlgos.js';

// 経路クイズ（#23）：A―M―B の中間 M を当てる。
//   直接つながっていない A,B を、共通の隣接 M でつなぐ形にする。
//   [{ a, b, answer, distractors }]
export function pathQuizzes(graph, { limit = 10 } = {}) {
  const out = [];
  const nodeIds = Object.keys(graph.nodes);
  for (const m of nodeIds) {
    const nb = neighbors(graph, m).map((n) => n.other);
    if (nb.length < 2) continue;
    const a = nb[0];
    const b = nb[1];
    // A,B が直接つながっていないほど「中間 M」が意味を持つ
    const directAB = neighbors(graph, a).some((n) => n.other === b);
    if (directAB) continue;
    const distractors = nodeIds.filter((x) => x !== m && x !== a && x !== b).slice(0, 3);
    if (distractors.length < 1) continue;
    out.push({ a, b, answer: m, distractors });
    if (out.length >= limit) break;
  }
  return out;
}

// 束グルーピング（#24）：ある概念と「同じかたまり（クラスタ）」の仲間を当てる。
//   [{ concept, answer(同クラスタ), distractors(別クラスタ) }]
export function groupQuizzes(graph, { limit = 10 } = {}) {
  const comps = connectedComponents(graph).filter((c) => c.length >= 2);
  if (comps.length < 2) return [];
  const out = [];
  for (let i = 0; i < comps.length && out.length < limit; i++) {
    const comp = comps[i];
    const concept = comp[0];
    const answer = comp[1]; // 同じかたまりの別概念
    // 別のかたまりから distractor を集める
    const others = comps.filter((_, j) => j !== i).flatMap((c) => c).slice(0, 3);
    if (others.length < 1) continue;
    out.push({ concept, answer, distractors: others });
  }
  return out;
}

// 選択肢を組み立てる（正解＋distractors をまぜる）。rnd は 0..1 の乱数関数（既定 Math.random）。
export function buildOptions(answer, distractors, rnd = Math.random) {
  const opts = [answer, ...distractors];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return opts;
}
