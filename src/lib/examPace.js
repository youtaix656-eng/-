// 模試のペース管理（①）— 本番形式(am/pm)の時間制限モード用。
//   経過時間から「今ごろ何問目にいるべきか」を算出し、リアルタイムの目安表示に使う。
//   終了後は各問にかけた時間から「使いすぎた問題」のランキングを作る。

// 経過時間・総時間・総問題数から、今ごろ到達しているべき問題番号（1始まり換算の目安）を返す
export function expectedProgress(elapsedSec, totalSec, totalQuestions) {
  if (!totalSec || totalQuestions <= 0) return 0;
  const frac = Math.max(0, Math.min(1, elapsedSec / totalSec));
  return Math.min(totalQuestions, Math.round(frac * totalQuestions));
}

// 現在の問題番号（0始まりidx）が目安より margin 問以上遅れているか
export function isBehindPace(idx, expectedIdx, margin = 2) {
  return idx + 1 < expectedIdx - margin;
}

// 各問にかけた時間（秒、order[i]に対応）から、時間を使いすぎた問題の上位を返す
export function rankSlowQuestions(order, timeSpent, limit = 5) {
  return order
    .map((q, i) => ({ q, sec: timeSpent[i] || 0 }))
    .filter((r) => r.sec > 0)
    .sort((a, b) => b.sec - a.sec)
    .slice(0, limit);
}
