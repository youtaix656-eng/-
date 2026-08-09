// 共起・連結ビルダー（#4）— 解いた問題群から概念のつながりを重み付きで作る。
//   単純な共起回数だけでなく PMI（自己相互情報量）で「汎用語だから一緒に出るだけ」を減衰し、
//   本当に結びつきの強いペアを浮かび上がらせる。documents = 各問題の概念配列。

function pairKey(a, b) {
  return a < b ? `${a}${b}` : `${b}${a}`;
}

// PMI(a,b) = log( P(a,b) / (P(a) P(b)) )。正値ほど強い連想。
export function pmiWeights(documents) {
  const N = documents.length || 1;
  const cnt = new Map(); // 概念の出現文書数
  const pair = new Map(); // ペアキー -> { a, b, co }
  for (const doc of documents) {
    const ids = [...new Set(doc)].filter(Boolean);
    ids.forEach((id) => cnt.set(id, (cnt.get(id) || 0) + 1));
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i];
        const b = ids[j];
        const k = pairKey(a, b);
        const cur = pair.get(k) || { a: a < b ? a : b, b: a < b ? b : a, co: 0 };
        cur.co += 1;
        pair.set(k, cur);
      }
  }
  const out = new Map();
  for (const [k, { a, b, co }] of pair) {
    const pa = cnt.get(a) / N;
    const pb = cnt.get(b) / N;
    const pab = co / N;
    const pmi = Math.log(pab / (pa * pb));
    out.set(k, { a, b, co, pmi });
  }
  return out;
}

// PMI 重みを知識グラフの各エッジの strength に反映（正のPMIのみ採用）。
export function applyPmiStrength(graph, documents) {
  const w = pmiWeights(documents);
  for (const { a, b, pmi } of w.values()) {
    const key = a < b ? `${a}${b}coOccurs` : `${b}${a}coOccurs`;
    const e = graph.edges[key];
    if (e) e.strength = Math.max(0, pmi);
  }
  return graph;
}

// documents から「最も結びつきが強いペア」上位を返す（表示・推薦のヒント）。
export function topAssociations(documents, { limit = 20, minCo = 2 } = {}) {
  const w = [...pmiWeights(documents).values()].filter((x) => x.co >= minCo && x.pmi > 0);
  w.sort((x, y) => y.pmi - x.pmi);
  return w.slice(0, limit);
}
