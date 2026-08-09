// 連結の間隔反復（#8）— ノードだけでなく「つながり（辺）」自体を忘却曲線で復習する。
//   関係が薄れる前に再提示するため、辺に軽量な Leitner 式スケジュールを持たせる。純粋関数。

const DAY_MS = 24 * 60 * 60 * 1000;
// Leitfrom ボックス→間隔（日）
const BOX_DAYS = [0, 1, 3, 7, 16, 35];

export function emptyEdgeSrs() {
  return { box: 0, due: 0, reps: 0 };
}

// 連結の想起に成功/失敗した結果でスケジュールを更新（新しい状態を返す）。
export function scheduleEdge(state, correct, now = Date.now()) {
  const s = state ? { ...state } : emptyEdgeSrs();
  if (correct) {
    s.box = Math.min(BOX_DAYS.length - 1, (s.box || 0) + 1);
    s.reps = (s.reps || 0) + 1;
  } else {
    s.box = 1; // 失敗は最初の間隔へ戻す（0だと即再出になりすぎるため1）
  }
  s.due = now + BOX_DAYS[s.box] * DAY_MS;
  s.last = now;
  return s;
}

export function isEdgeDue(state, now = Date.now()) {
  if (!state) return true; // 未スケジュールの連結は復習対象
  return (state.due || 0) <= now;
}

// グラフから復習期限が来た連結を返す（強い順）。edge.srs に状態を持たせる想定。
export function dueAssociations(graph, now = Date.now(), { limit = 0 } = {}) {
  const rows = [];
  for (const e of Object.values(graph.edges)) {
    if (isEdgeDue(e.srs, now)) rows.push(e);
  }
  rows.sort((a, b) => (b.strength || b.weight || 0) - (a.strength || a.weight || 0));
  return limit > 0 ? rows.slice(0, limit) : rows;
}
