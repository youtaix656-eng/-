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
// pace（実際に聞いた1問あたりの秒数の記録、loadAudioPace）がある時は、そちらを使う。
// 固定の12秒だと、解説の長い問題ばかりの束では実際の半分ほどに見積もっていた
// （「5分だけ」が8分以上かかる・3分の2バッファ術が60分で480問になる、など）。
export function audioSecPerItem({ rate = 1, gapSeconds = 2, nextGapSeconds = 1, pace = null } = {}) {
  const r = Math.max(0.1, rate);
  if (pace && pace.sec > 0 && pace.rate > 0 && (pace.n || 0) >= PACE_MIN_SAMPLES) {
    // 読み上げの部分は速度に反比例するとみなして、記録した時の速度から今の速度へ直す（目安）
    return Math.max(3, Math.round((pace.sec * pace.rate) / r));
  }
  return 12 / r + gapSeconds + nextGapSeconds;
}

export function estimateAudioSeconds(count, opts = {}) {
  return Math.round(count * audioSecPerItem(opts));
}

// 実際に聞いた1問あたりの秒数（端末内。shinkyu: で始めるのでバックアップにも入る）。
// 5問以上聞いてから使う（少なすぎると、たまたま短い問題が続いた時に大きくずれるため）。
export const PACE_MIN_SAMPLES = 5;
const PACE_KEY = 'shinkyu:audioPace';
export function loadAudioPace() {
  try { const v = JSON.parse(localStorage.getItem(PACE_KEY) || 'null'); return v && v.sec > 0 ? v : null; } catch { return null; }
}
// sec：1問を聞き終えてから次の1問を聞き終えるまでの秒数。一時停止をはさんだ等で長すぎる・短すぎるものは捨てる。
export function nextAudioPace(prev, sec, rate) {
  if (!(sec >= 2 && sec <= 180) || !(rate > 0)) return prev || null;
  if (!prev || !(prev.rate > 0)) return { sec: Math.round(sec * 10) / 10, rate, n: 1 };
  // 速度をそろえてからならす（記録の速度に直して平均する）
  const asPrevRate = (sec * rate) / prev.rate;
  const alpha = 0.2;
  return { sec: Math.round(((1 - alpha) * prev.sec + alpha * asPrevRate) * 10) / 10, rate: prev.rate, n: Math.min(999, (prev.n || 0) + 1) };
}
export function saveAudioPace(p) {
  try { if (p) localStorage.setItem(PACE_KEY, JSON.stringify(p)); } catch { /* 保存できなくても見積もりが固定値に戻るだけ */ }
}

export function formatEstimateMinutes(sec) {
  const min = Math.round(sec / 60);
  return min <= 0 ? '1分未満' : `約${min}分`;
}
