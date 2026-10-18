// 学習(10・60・300・900)で使っている「今日はどれでやるか」の目安件数の単一の正。
// 音声学習（AudioMode.jsx）の「間違えた問題を読み上げる」でも同じ数・同じ呼び名を使うため、
// Session.jsxのローカル定数をここへ切り出した（両方が同じ数字を別々に持つと、
// 片方だけ直した時に食い違う）。
export const SESSION_TARGETS = [10, 60, 300, 900];

export function sessionTargetLabel(t) {
  return t === 10 ? 'すきま時間' : t === 60 ? '1セット（区切り）' : t === 300 ? '1日の目標' : '1周（周回）';
}

// 音声学習で件数チップを選ぶ時の、所要時間の目安（秒）。実測ではなく
// 「1問あたり平均12秒ぶん読む」という大まかな仮定に、再生速度・間（秒）・
// 次へ進むまでの間（秒）を加味した見積もりでしかないため、呼び出し側は必ず
// 「目安」と明記すること（手元に無い基準を断定で出さない、の方針どおり）。
export function estimateAudioSeconds(count, { rate = 1, gapSeconds = 2, nextGapSeconds = 1 } = {}) {
  const perItem = 12 / Math.max(0.1, rate) + gapSeconds + nextGapSeconds;
  return Math.round(count * perItem);
}

export function formatEstimateMinutes(sec) {
  const min = Math.round(sec / 60);
  return min <= 0 ? '1分未満' : `約${min}分`;
}
