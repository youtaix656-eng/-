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
const MAX_EF = 3.5; // efは正解のたびに増え続ける参考値なので、間隔計算に使う上は上限を設ける

// 5回連続「○（完璧）」でマスター（復習リストから外れる）
export const MASTER_STREAK = 5;

// この回数以上間違えた問題は「リーチ（要注意）」— Review.jsx・MistakeNote.jsxで共用
export const LEECH_THRESHOLD = 8;
export function isLeech(state) {
  return (normalize(state).wrongCount || 0) >= LEECH_THRESHOLD;
}

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
    // correctStreak が無い古い状態にも既定を補う。
    // 呼び出し側（applyGrade等）がここで返した値を直接書き換えるため、
    // 元のstateと同じ参照を返さない（同じ参照だとReact 18のStrictModeで
    // setState更新関数が2回呼ばれた時に同じオブジェクトへ2回加点してしまう）。
    return { ...state, correctStreak: state.correctStreak == null ? 0 : state.correctStreak };
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
// opts.paceMultiplier: 正解時の間隔だけに掛ける倍率（既定1＝原典どおり）。
//   ユーザーが設定で調整できる「復習ペース」。誤答時の約20分後リセットは
//   ユーザー指定の固定仕様なので、ここでは一切変えない。
export function applyGrade(state, grade, now = Date.now(), opts = {}) {
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
      // efは「この問題がどれだけ楽に正解できているか」の参考値として計算済みだが、
      // 以前は間隔の計算に一切使われていなかった（計算されるだけの死んだ値）。
      // ここでefの比率（既定2.5からどれだけ伸びたか）と、設定のペース倍率を掛けて
      // 実際の間隔に反映する。efは正解でしか増えない（誤答では変えない、上の方針は
      // ユーザー指定のため不変）ので、この係数は1.0以上にしかならない＝間隔を
      // 縮める方向には効かない。
      const baseDays = EBBINGHAUS_DAYS[s.correctStreak] || 16;
      const efFactor = s.ef / DEFAULT_EF;
      const paceMultiplier = opts.paceMultiplier || 1;
      const days = Math.max(1, Math.round(baseDays * efFactor * paceMultiplier));
      s.interval = days;
      s.due = now + days * DAY_MS;
    }
    s.ef = Math.min(MAX_EF, Math.max(MIN_EF, s.ef + 0.05)); // 参考値（上限を設けて間隔が際限なく伸びないようにする）
  }
  return s;
}

// 正誤のみから grade を推定して適用（模試など○△✕が無い場面）
export function applyAnswer(state, correct, now = Date.now(), opts = {}) {
  return applyGrade(state, correct ? GRADES.good : GRADES.again, now, opts);
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

// リーチ（要注意）になった「まさにこの回答」かどうか（直前は未満・直後で到達）。
// Review.jsx側で、回答直後にprev/nextのstateを渡して「今リーチになった」を一度だけ知らせるために使う。
export function justBecameLeech(prevState, nextState) {
  return !isLeech(prevState) && isLeech(nextState);
}

// リーチ状態だった問題が、その解答でマスター（5連続○）に達した＝リーチ解消の瞬間かどうか。
export function justResolvedLeech(prevState, nextState) {
  return isLeech(prevState) && !isMastered(prevState) && isMastered(nextState);
}

// 復習対象（isInReview）の期限をすべて「今」に揃える（#16 全体の間隔をリセット）。
// 誤答回数・連続記録などの実績は消さず、次にいつ出るかだけをリセットする。
// マスター済み・一度も間違えていない問題には触れない。
export function resetDueForReview(srsMap, now = Date.now()) {
  const out = {};
  for (const [id, state] of Object.entries(srsMap || {})) {
    out[id] = isInReview(state) ? { ...normalize(state), due: now } : state;
  }
  return out;
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
