// 間隔反復（スペースドリピティション）ロジック
//
// Leitner（ライトナー）方式のボックスモデルを採用。
// 正解すると次のボックスへ進み、次回出題までの間隔が延びる。
// 間違えるとボックス0へ戻り、すぐに復習対象となる。

// 各ボックスの復習間隔（日数）。box が大きいほど間隔が長い。
const INTERVALS_DAYS = [0, 1, 3, 7, 16, 35, 90];
const MAX_BOX = INTERVALS_DAYS.length - 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export function emptyState() {
  return {
    box: 0,
    due: 0,
    correctStreak: 0,
    wrongCount: 0,
    seen: 0,
    lastResult: null,
    lastAnswered: 0,
  };
}

// 解答結果を反映して新しい SRS 状態を返す
export function applyAnswer(state, correct, now = Date.now()) {
  const s = { ...(state || emptyState()) };
  s.seen += 1;
  s.lastAnswered = now;
  s.lastResult = correct ? 'correct' : 'wrong';

  if (correct) {
    s.correctStreak += 1;
    s.box = Math.min(MAX_BOX, s.box + 1);
  } else {
    s.correctStreak = 0;
    s.wrongCount += 1;
    s.box = 0; // 誤答は最初のボックスへ戻す
  }
  const intervalDays = INTERVALS_DAYS[s.box];
  s.due = now + intervalDays * DAY_MS;
  return s;
}

// この問題が「間違えた問題（復習対象）」かどうか
// 一度でも誤答し、まだ十分に定着していない（ボックスが最大未満）ものを対象にする
export function isInReview(state) {
  if (!state) return false;
  return state.wrongCount > 0 && state.box < MAX_BOX;
}

// いま復習期限が来ているか
export function isDue(state, now = Date.now()) {
  if (!state) return false;
  return (state.due || 0) <= now;
}

// 復習対象の問題を、期限が近い順（＝優先度の高い順）に並べる
export function sortByPriority(questions, srs, now = Date.now()) {
  return [...questions].sort((a, b) => {
    const sa = srs[a.id] || emptyState();
    const sb = srs[b.id] || emptyState();
    // 期限が過ぎているものを優先、次に box が低いもの（未定着）を優先
    const dueA = (sa.due || 0) - now;
    const dueB = (sb.due || 0) - now;
    if (dueA !== dueB) return dueA - dueB;
    return sa.box - sb.box;
  });
}

export { INTERVALS_DAYS, MAX_BOX };
