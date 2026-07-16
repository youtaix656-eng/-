// 間隔反復（スペースドリピティション）ロジック — SM-2 準拠
//
// SuperMemo SM-2 アルゴリズムを採用。各問題は以下を持つ:
//   ef        : easiness factor（易しさ係数, 初期 2.5, 最小 1.3）
//   interval  : 次回出題までの間隔（日）
//   reps      : 連続正解回数
//   due       : 次回出題日時
// 解答時の自己評価（grade）で間隔を調整する:
//   0: もう一度（不正解）  3: むずかしい  4: ふつう  5: かんたん
//
// 単純な○×/四択の正誤しか無い場面では、正解=4(ふつう)・不正解=0 として扱う。

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EF = 1.3;
const DEFAULT_EF = 2.5;

// 「定着した（もう復習リストから外してよい）」とみなす間隔のしきい値（日）
export const MATURE_INTERVAL = 21;

// 自己評価グレード
export const GRADES = {
  again: 0, // もう一度
  hard: 3, // むずかしい
  good: 4, // ふつう
  easy: 5, // かんたん
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

// 旧 Leitner 形式（box を持つ）の状態を SM-2 形式へ移行
function normalize(state) {
  if (!state) return emptyState();
  if (state.ef != null && state.interval != null) return state; // 既に SM-2
  // box → interval のおおよその変換
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
// grade: GRADES のいずれか（0/3/4/5）
export function applyGrade(state, grade, now = Date.now()) {
  const s = normalize(state);
  s.seen += 1;
  s.lastAnswered = now;

  const correct = grade >= 3;
  s.lastResult = correct ? 'correct' : 'wrong';

  if (!correct) {
    // 不正解: 連続正解をリセットし、翌日に再出題
    s.reps = 0;
    s.correctStreak = 0;
    s.wrongCount += 1;
    s.interval = 1;
  } else {
    s.correctStreak += 1;
    s.reps += 1;
    if (s.reps === 1) s.interval = 1;
    else if (s.reps === 2) s.interval = 6;
    else s.interval = Math.round(s.interval * s.ef);

    // EF の更新（SM-2 の式）
    s.ef = Math.max(
      MIN_EF,
      s.ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    );
    // かんたん/むずかしい で軽く補正
    if (grade === GRADES.hard) s.interval = Math.max(1, Math.round(s.interval * 0.6));
  }
  s.due = now + s.interval * DAY_MS;
  return s;
}

// 正誤のみから grade を推定して適用（一問一答・模試用）
export function applyAnswer(state, correct, now = Date.now()) {
  return applyGrade(state, correct ? GRADES.good : GRADES.again, now);
}

// この問題が「間違えた問題（復習対象）」か
// 一度でも誤答し、まだ十分に定着していない（間隔が MATURE 未満）もの
export function isInReview(state) {
  const s = normalize(state);
  return s.wrongCount > 0 && s.interval < MATURE_INTERVAL;
}

// いま復習期限が来ているか
export function isDue(state, now = Date.now()) {
  const s = normalize(state);
  return (s.due || 0) <= now;
}

// 復習対象を優先度順（期限が過ぎている順→間隔が短い順）に並べる
export function sortByPriority(questions, srs, now = Date.now()) {
  return [...questions].sort((a, b) => {
    const sa = normalize(srs[a.id]);
    const sb = normalize(srs[b.id]);
    const dueA = (sa.due || 0) - now;
    const dueB = (sb.due || 0) - now;
    if (dueA !== dueB) return dueA - dueB;
    return sa.interval - sb.interval;
  });
}

export { normalize };
