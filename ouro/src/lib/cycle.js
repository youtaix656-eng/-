// 知識の循環（Ouroboros）。
//
//   情報 → 収集 → 整理 → 分析 → 検証 → 保存 → 活用 → 新しい結果 → 再び知識へ
//
// 「AI社員が働けば働くほど知識資産が増える」ことを数字で見せるための計算。

export const CYCLE_STAGES = [
  { id: 'collect', name: '収集', roleId: 'researcher', glyph: '↓' },
  { id: 'organize', name: '整理', roleId: 'analyzer', glyph: '⋮' },
  { id: 'verify', name: '検証', roleId: 'reviewer', glyph: '⚖' },
  { id: 'store', name: '保存', roleId: null, glyph: '◉' },
  { id: 'apply', name: '活用', roleId: 'strategist', glyph: '✦' },
];

/** どの段階がどれだけ回っているか。手薄な段階を見つけるために使う。 */
export function cycleStats({ tasks = [], knowledge = [] }) {
  const steps = tasks.flatMap((t) => t.steps || []);
  const done = (roleId) => steps.filter((s) => s.roleId === roleId && s.status === 'done').length;

  return CYCLE_STAGES.map((stage) => {
    if (stage.id === 'store') return { ...stage, count: knowledge.length };
    if (stage.id === 'apply') {
      return { ...stage, count: knowledge.filter((k) => (k.usedCount || 0) > 0).length };
    }
    return { ...stage, count: done(stage.roleId) };
  });
}

/** 循環が止まっている段階（次に手を打つべきところ）を1つ返す。 */
export function weakestStage(stats) {
  if (!stats.length) return null;
  return [...stats].sort((a, b) => a.count - b.count)[0];
}

/** 知識の増え方（直近 days 日の1日ごとの新規数）。 */
export function growthSeries(knowledge = [], days = 14, now = Date.now()) {
  const dayMs = 86400000;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const from = start.getTime() - i * dayMs;
    const to = from + dayMs;
    out.push({
      date: from,
      count: knowledge.filter((k) => k.createdAt >= from && k.createdAt < to).length,
      total: knowledge.filter((k) => k.createdAt < to).length,
    });
  }
  return out;
}
