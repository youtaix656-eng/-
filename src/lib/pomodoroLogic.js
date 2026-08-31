// ポモドーロタイマーの純粋ロジック（UIを持たない・単体テスト可能）。
// setInterval任せの1秒ずつの減算は、タブをバックグラウンドに回すとブラウザが間引くため
// 実時間とズレる。ここでは「フェーズが終わる時刻（phaseEndAt）」を基準にし、
// 今の時刻との差から残り時間・経過したフェーズ数を毎回計算し直す方式にする。

export const PHASES = ['idle', 'study', 'short', 'long'];

// フェーズの長さ（秒）。idle中は「勉強を始めたらどれだけか」の目安として study と同じ扱い。
export function durationSec(phase, cfg) {
  const c = cfg || {};
  if (phase === 'study') return (c.study || 25) * 60;
  if (phase === 'short') return (c.shortBreak || 5) * 60;
  if (phase === 'long') return (c.longBreak || 15) * 60;
  return (c.study || 25) * 60;
}

// mm:ss表示。負の値やNaNは0として扱う（表示が壊れないようにする防御）。
export function mmss(totalSeconds) {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// 1フェーズ終了時の遷移先。study終了時だけdoneが+1され、cyclesごとにlong、それ以外はshort。
// 休憩終了時は常にstudyへ戻る。
export function nextPhaseAfter(phase, done, cfg) {
  if (phase === 'study') {
    const n = done + 1;
    const isLong = n % ((cfg && cfg.cycles) || 4) === 0;
    return { next: isLong ? 'long' : 'short', done: n, wasStudy: true };
  }
  return { next: 'study', done, wasStudy: false };
}

// now時点まで状態を進める。phaseEndAtを過ぎているフェーズが複数またがっていても
// （＝タブが長時間バックグラウンドで眠っていた場合）、1つずつ辿って正しい終着点を返す。
// 強制的に0扱いにしたり、フェーズを1回分しか進めなかったりしない。
// guardは無限ループ防止（cfgの分数が壊れて0になっている等の異常系向け）。
export function advanceState({ phase, phaseEndAt, done, cfg, now = Date.now() }, guard = 2000) {
  let curPhase = phase;
  let curDone = done;
  let curEnd = phaseEndAt;
  const transitions = [];
  let i = 0;
  while (curPhase !== 'idle' && now >= curEnd && i < guard) {
    i += 1;
    const { next, done: newDone, wasStudy } = nextPhaseAfter(curPhase, curDone, cfg);
    transitions.push({ from: curPhase, to: next, wasStudy });
    curDone = newDone;
    curPhase = next;
    curEnd = curEnd + durationSec(curPhase, cfg) * 1000;
  }
  return { phase: curPhase, phaseEndAt: curEnd, done: curDone, transitions };
}

// 表示用の残り秒数（running中はphaseEndAtから逆算、停止中はremainingをそのまま使う）。
export function remainingSecOf({ running, phaseEndAt, remaining }, now = Date.now()) {
  if (!running) return remaining;
  return Math.max(0, Math.ceil((phaseEndAt - now) / 1000));
}
