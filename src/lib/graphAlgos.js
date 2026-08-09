// 知識グラフのアルゴリズム（#10 最短経路 ほか）— 純粋関数。
//   「AとBはどうつながる？」を辺をたどって示す。

// 無向グラフの隣接リストを作る
function adjacency(graph) {
  const adj = new Map();
  const add = (x, y, e) => {
    if (!adj.has(x)) adj.set(x, []);
    adj.get(x).push({ to: y, type: e.type });
  };
  for (const e of Object.values(graph.edges)) { add(e.a, e.b, e); add(e.b, e.a, e); }
  return adj;
}

// a→b の最短経路（ノードid配列）。到達不可なら null、同一なら [a]。
export function shortestPath(graph, a, b) {
  if (!a || !b) return null;
  if (a === b) return [a];
  if (!graph.nodes[a] || !graph.nodes[b]) return null;
  const adj = adjacency(graph);
  const prev = new Map([[a, null]]);
  const queue = [a];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === b) break;
    for (const { to } of adj.get(cur) || []) {
      if (!prev.has(to)) { prev.set(to, cur); queue.push(to); }
    }
  }
  if (!prev.has(b)) return null;
  const path = [];
  let cur = b;
  while (cur != null) { path.unshift(cur); cur = prev.get(cur); }
  return path;
}

// 経路上の各ステップの関係タイプ（表示用）。path 長 n → n-1 ステップ。
export function pathRelations(graph, path) {
  const out = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const key = a < b ? a + b : b + a;
    const e = Object.values(graph.edges).find((x) => (x.a + x.b === key) || (x.b + x.a === key) || (x.a === a && x.b === b) || (x.a === b && x.b === a));
    out.push({ from: a, to: b, type: e?.type || 'coOccurs' });
  }
  return out;
}
