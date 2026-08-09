// 忘却予測（#6）— 定着済みでも「近く忘れそう」な問題を先読みする純粋関数。
//   エビングハウス的な指数減衰で保持率 R = exp(-経過 / 安定度) を推定。
//   安定度は SRS の interval（日）を使い、復習からの経過が長いほど R が下がる。

const DAY_MS = 24 * 60 * 60 * 1000;

// 最後に復習した時刻の推定（due = 最終復習 + interval日 なので逆算）
function lastReviewed(state) {
  if (!state) return 0;
  if (state.lastReviewed) return state.lastReviewed;
  if (state.due && state.interval) return state.due - state.interval * DAY_MS;
  return 0;
}

// 保持率（0〜1）。学習履歴が無い/間隔0のものは判定対象外として null。
export function retrievability(state, now = Date.now()) {
  if (!state || (state.seen || 0) === 0) return null;
  const interval = state.interval || 0;
  if (interval <= 0) return null; // 未定着（間違えた直後など）は対象外
  const lr = lastReviewed(state);
  if (!lr) return null;
  const stability = interval * DAY_MS;
  const elapsed = Math.max(0, now - lr);
  return Math.exp(-elapsed / stability);
}

// 忘却リスク＝1-保持率。しきい値以上のものを高い順に返す。
//   [{ id, question, risk, retrievability }]
export function forgettingRisk(questions, srs, { now = Date.now(), threshold = 0.3, limit = 0 } = {}) {
  const out = [];
  for (const q of questions) {
    const r = retrievability(srs[q.id], now);
    if (r == null) continue;
    const risk = 1 - r;
    if (risk >= threshold) out.push({ id: q.id, question: q, risk, retrievability: r });
  }
  out.sort((a, b) => b.risk - a.risk);
  return limit > 0 ? out.slice(0, limit) : out;
}
