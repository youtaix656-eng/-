// 連想強度モデル（#7）— スプレッディング活性化と、辺の強化／時間減衰。
//   「一緒に想起できた」つながりを強め、使わないつながりは時間で薄れる。純粋関数。

const DAY_MS = 24 * 60 * 60 * 1000;

// 辺を強化（共起想起の成否で増減）。破壊的に edge を更新。
export function reinforceEdge(edge, correct, now = Date.now(), { up = 0.6, down = 0.2, cap = 10 } = {}) {
  if (!edge) return edge;
  const cur = edge.strength || 0;
  edge.strength = Math.max(0, Math.min(cap, cur + (correct ? up : -down)));
  edge.lastReinforced = now;
  return edge;
}

// 時間減衰した実効強度（半減期 halfLifeDays）。元データは変えない。
export function effectiveStrength(edge, now = Date.now(), { halfLifeDays = 30 } = {}) {
  const s = edge.strength || 0;
  if (!edge.lastReinforced || s <= 0) return s;
  const elapsed = Math.max(0, now - edge.lastReinforced);
  return s * Math.pow(0.5, elapsed / (halfLifeDays * DAY_MS));
}

// スプレッディング活性化：seed 概念から辺をたどって活性を広げる。
//   返り値 Map(concept -> activation)。activation が高い＝連想で想起されやすい。
export function spreadingActivation(graph, seeds, { decay = 0.5, maxDepth = 2, now = Date.now() } = {}) {
  const act = new Map();
  const seedList = (Array.isArray(seeds) ? seeds : [seeds]).filter(Boolean);
  let frontier = seedList.map((id) => ({ id, level: 1 }));
  seedList.forEach((id) => act.set(id, 1));
  for (let d = 0; d < maxDepth; d++) {
    const next = [];
    for (const { id, level } of frontier) {
      for (const e of Object.values(graph.edges)) {
        let other = null;
        if (e.a === id) other = e.b;
        else if (e.b === id) other = e.a;
        if (!other) continue;
        const w = Math.max(0.1, effectiveStrength(e, now) || e.weight || 1);
        const passed = level * decay * (w / (w + 1)); // 強い辺ほど活性が伝わる
        const prev = act.get(other) || 0;
        if (passed > prev) { act.set(other, passed); next.push({ id: other, level: passed }); }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return act;
}

// 活性の高い順（seed 自身は除く）
export function rankByActivation(actMap, seeds) {
  const seedSet = new Set(Array.isArray(seeds) ? seeds : [seeds]);
  return [...actMap.entries()]
    .filter(([id]) => !seedSet.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id, a]) => ({ id, activation: a }));
}
