// 間隔反復（スペースドリピティション）ロジック — エビングハウスの忘却曲線
//
// 方針（ユーザー指定）:
//  - 間違えた／△（あいまい）／✕（自信なし）の問題だけが復習対象に入る。
//  - 復習は「忘却曲線」に沿って間隔を空けて再出題する。
//  - 「○（完璧）」が **5回連続** で続くまでマスター扱いにしない。
//    途中で △・✕・誤答があれば連続はリセットされ、約20分後から再スタート。
//
// 各問題が持つ状態:
//   correctStreak : 連続「○（完璧＝正解）」回数（5でマスター）
//   wrongCount    : これまでの誤答（△✕含む）回数（1以上で復習対象）
//   interval      : 次回までの間隔（日・表示用）
//   due           : 次回出題日時
//   ef/reps/seen  : 参考値（後方互換のため保持）

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EF = 1.3;
const DEFAULT_EF = 2.5;

// 5回連続「○（完璧）」でマスター（復習リストから外れる）
export const MASTER_STREAK = 5;

// エビングハウスの忘却曲線に沿った復習間隔（連続「完璧」回数 → 次回までの日数）
//   1回目の完璧の後は1日後、以降 3日・7日・16日 と広げ、5回目でマスター。
const EBBINGHAUS_DAYS = [0, 1, 3, 7, 16];
// 誤答／△／✕ の後は約20分後に再出題（忘却曲線の最初の復習ポイント）
const WRONG_DELAY_MS = 20 * 60 * 1000;

// 「定着（マスター）」の目安として残す（互換用）。
export const MATURE_INTERVAL = 21;

// 自己評価グレード（○＝easy が「完璧」。△・✕・誤答は again）
export const GRADES = {
  again: 0, // △・✕・もう一度（連続リセット）
  hard: 3, // むずかしい
  good: 4, // ふつう（正解）
  easy: 5, // ○ 完璧
};

export function emptyState() {
  return {
    ef: DEFAULT_EF,
    interval: 0,
    reps: 0,
    due: 0,
    seen: 0,
    wrongCount: 0,
    correctStreak: 0,
    lastResult: null,
    lastAnswered: 0,
  };
}

// 旧 Leitner 形式（box を持つ）の状態を移行
function normalize(state) {
  if (!state) return emptyState();
  if (state.ef != null && state.interval != null) {
    // correctStreak が無い古い状態にも既定を補う
    if (state.correctStreak == null) return { ...state, correctStreak: 0 };
    return state;
  }
  const boxDays = [0, 1, 3, 7, 16, 35, 90];
  const box = state.box || 0;
  return {
    ...emptyState(),
    ef: DEFAULT_EF,
    interval: boxDays[Math.min(box, boxDays.length - 1)] || 0,
    reps: box,
    due: state.due || 0,
    seen: state.seen || 0,
    wrongCount: state.wrongCount || 0,
    correctStreak: state.correctStreak || 0,
    lastResult: state.lastResult || null,
    lastAnswered: state.lastAnswered || 0,
  };
}

// 解答結果を反映して新しい SRS 状態を返す
// grade: GRADES のいずれか（0=△✕/誤答, 3/4=正解, 5=○完璧）
export function applyGrade(state, grade, now = Date.now()) {
  const s = normalize(state);
  s.seen += 1;
  s.lastAnswered = now;

  const correct = grade >= 3; // ○（完璧）や正解
  s.lastResult = correct ? 'correct' : 'wrong';

  if (!correct) {
    // △・✕・誤答：連続をリセットし、約20分後に再出題（忘却曲線の初回）
    s.reps = 0;
    s.correctStreak = 0;
    s.wrongCount += 1;
    s.interval = 0;
    s.due = now + WRONG_DELAY_MS;
  } else {
    // ○（完璧）：連続を伸ばし、忘却曲線に沿って間隔を延ばす
    s.correctStreak += 1;
    s.reps += 1;
    if (s.correctStreak >= MASTER_STREAK) {
      // 5回連続でマスター。以後は復習リストから外れる（十分先へ）
      s.interval = 60;
      s.due = now + 60 * DAY_MS;
    } else {
      const days = EBBINGHAUS_DAYS[s.correctStreak] || 16;
      s.interval = days;
      s.due = now + days * DAY_MS;
    }
    s.ef = Math.max(MIN_EF, s.ef + 0.05); // 参考値
  }
  return s;
}

// 正誤のみから grade を推定して適用（模試など○△✕が無い場面）
export function applyAnswer(state, correct, now = Date.now()) {
  return applyGrade(state, correct ? GRADES.good : GRADES.again, now);
}

// この問題が「復習対象」か
// 一度でも間違え（△✕含む）、まだ5回連続の完璧に達していないもの
export function isInReview(state) {
  const s = normalize(state);
  return s.wrongCount > 0 && (s.correctStreak || 0) < MASTER_STREAK;
}

// マスター（5回連続の完璧を達成）したか
export function isMastered(state) {
  const s = normalize(state);
  return (s.correctStreak || 0) >= MASTER_STREAK;
}

// いま復習期限が来ているか
export function isDue(state, now = Date.now()) {
  const s = normalize(state);
  return (s.due || 0) <= now;
}

// 復習対象を優先度順（期限が過ぎている順→連続完璧が少ない順）に並べる
export function sortByPriority(questions, srs, now = Date.now()) {
  return [...questions].sort((a, b) => {
    const sa = normalize(srs[a.id]);
    const sb = normalize(srs[b.id]);
    const dueA = (sa.due || 0) - now;
    const dueB = (sb.due || 0) - now;
    if (dueA !== dueB) return dueA - dueB;
    return (sa.correctStreak || 0) - (sb.correctStreak || 0);
  });
}

export { normalize };
