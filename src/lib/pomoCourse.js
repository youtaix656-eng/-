// ポモドーロタイマー「2時間コース」（25分勉強+5分休憩×4回）の純粋ロジック。
// Pomodoro.jsx（React・タブが裏に回っても時刻ベースで追いつく仕組み）から呼ばれる
// 副作用の無い部分だけをここに切り出す（node:testで検証できるようにするため）。
//
// フェーズは study→break→study→break→…→study→break の8コマ（研究4回＋休憩4回）
// で固定。「合計2時間」はこの8コマの合計時間（25×4＋5×4＝120分）そのもの。

export const COURSE_PHASES = [
  { type: 'study', min: 25 },
  { type: 'break', min: 5 },
  { type: 'study', min: 25 },
  { type: 'break', min: 5 },
  { type: 'study', min: 25 },
  { type: 'break', min: 5 },
  { type: 'study', min: 25 },
  { type: 'break', min: 5 },
];

export const COURSE_TOTAL_MIN = COURSE_PHASES.reduce((s, p) => s + p.min, 0); // 120

export function coursePhaseLabel(type) {
  return type === 'break' ? '休憩' : '勉強';
}

// 「勉強◯/4」「休憩◯/4」のような、4回のうち何回目かの表示。
export function coursePhaseOrdinal(phaseIndex) {
  const p = COURSE_PHASES[phaseIndex];
  if (!p) return null;
  const sameTypeBefore = COURSE_PHASES.slice(0, phaseIndex + 1).filter((x) => x.type === p.type).length;
  const sameTypeTotal = COURSE_PHASES.filter((x) => x.type === p.type).length;
  return { type: p.type, n: sameTypeBefore, total: sameTypeTotal };
}

// 現在のフェーズ添字（phaseIndex）とその終わる時刻（endAt）から、「今」の時点で
// 本当はどのフェーズにいるべきかを求める。タブが裏に回って複数フェーズぶん時間が
// 過ぎていても、ここで一度にまとめて追いつく（音声学習・AudioMode.jsxのrunFromと
// 同じ「裏で長く止まっても追いつく」考え方）。
// 戻り値のphaseIndexがCOURSE_PHASES.lengthに達したら2時間コース終了（finished:true）。
// finished時のendAtは「本来2時間が経過した時刻」で固定される（catch-upの回数に
// 関わらずコース全体の所要時間は変わらない）。
export function catchUpCourse(phaseIndex, endAt, now = Date.now()) {
  let idx = phaseIndex;
  let at = endAt;
  while (idx < COURSE_PHASES.length && at <= now) {
    idx += 1;
    if (idx < COURSE_PHASES.length) at += COURSE_PHASES[idx].min * 60 * 1000;
  }
  return { phaseIndex: idx, endAt: at, finished: idx >= COURSE_PHASES.length };
}

// 指定したフェーズ添字・そのフェーズの終わる時刻から、コース全体の終了予定時刻
// （ミリ秒のタイムスタンプ）を求める（そのフェーズの終わる時刻＋残りフェーズの合計）。
export function courseScheduledEnd(phaseIndex, currentPhaseEndAt) {
  if (phaseIndex >= COURSE_PHASES.length) return currentPhaseEndAt;
  const restMs = COURSE_PHASES.slice(phaseIndex + 1).reduce((s, p) => s + p.min * 60 * 1000, 0);
  return currentPhaseEndAt + restMs;
}

// 休憩開始・休憩終了の10秒前からのカウントダウン音声文言。
// 10秒の時だけ「休憩開始まで10秒前」／「休憩終了まで10秒前」、9秒以降は数字だけを読む
// （phaseTypeは「今いるフェーズ」の種類＝study中のカウントダウンは休憩開始の予告、
// break中のカウントダウンは休憩終了の予告になる）。
export function courseCountdownText(phaseType, sec) {
  if (sec === 10) {
    return phaseType === 'study' ? '休憩開始まで10秒前' : '休憩終了まで10秒前';
  }
  return String(sec);
}

export function hhmmOf(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
