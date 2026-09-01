// ポモドーロタイマーの純粋ロジック（UIを持たない・単体テスト可能）。
// setInterval任せの1秒ずつの減算は、タブをバックグラウンドに回すとブラウザが間引くため
// 実時間とズレる。ここでは「フェーズが終わる時刻（phaseEndAt）」を基準にし、
// 今の時刻との差から残り時間・経過したフェーズ数を毎回計算し直す方式にする。

export const PHASES = ['idle', 'study', 'short', 'long'];

// 通知音の種類（周波数のプリセット）。Pomodoro.jsx（効果音を鳴らす側）と
// PomodoroConfigFields.jsx（選択UI）の両方から使うため、JSXを持たないこのファイルに置く
// （Pomodoro.jsxはApp.jsxの常時マウント対象なので、設定UI一式を静的importすると
// せっかくlazy化した設定パネルの起動時バンドルにまた含まれてしまう）。
export const BEEP_TONES = [
  { id: 'chime', label: 'チャイム風（既定）', freq: [660, 880] },
  { id: 'low', label: '低め・落ち着いた音', freq: [440, 550] },
  { id: 'high', label: '高め・目立つ音', freq: [880, 1175] },
];
export function toneFreq(cfg, kind) {
  const tone = BEEP_TONES.find((t) => t.id === (cfg && cfg.beepTone)) || BEEP_TONES[0];
  return kind === 'study' ? tone.freq[0] : tone.freq[1];
}

// advanceState の無限ループ防止ガード（cfgの分数が壊れて0になっている等の異常系向け）。
// 通常の利用（数分〜数時間のフェーズが数個進む程度）ではまず到達しない値。
export const ADVANCE_GUARD = 2000;

/**
 * フェーズの長さ（秒）。
 * @param {'idle'|'study'|'short'|'long'} phase
 * @param {{study?:number, shortBreak?:number, longBreak?:number}} cfg
 * @returns {number} 秒数。idle中は「勉強を始めたらどれだけか」の目安として study と同じ扱い。
 */
export function durationSec(phase, cfg) {
  const c = cfg || {};
  if (phase === 'study') return (c.study || 25) * 60;
  if (phase === 'short') return (c.shortBreak || 5) * 60;
  if (phase === 'long') return (c.longBreak || 15) * 60;
  return (c.study || 25) * 60;
}

/**
 * mm:ss表示。負の値やNaNは0として扱う（表示が壊れないようにする防御）。
 * @param {number} totalSeconds
 * @returns {string} 例: "05:00"
 */
export function mmss(totalSeconds) {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 1フェーズ終了時の遷移先。study終了時だけdoneが+1され、cyclesごとにlong、それ以外はshort。
 * 休憩終了時は常にstudyへ戻る。
 * @param {'study'|'short'|'long'} phase
 * @param {number} done これまでに完走したstudyフェーズ数
 * @param {{cycles?:number}} cfg
 * @returns {{next:'study'|'short'|'long', done:number, wasStudy:boolean}}
 */
export function nextPhaseAfter(phase, done, cfg) {
  if (phase === 'study') {
    const n = done + 1;
    const isLong = n % ((cfg && cfg.cycles) || 4) === 0;
    return { next: isLong ? 'long' : 'short', done: n, wasStudy: true };
  }
  return { next: 'study', done, wasStudy: false };
}

/**
 * now時点まで状態を進める。phaseEndAtを過ぎているフェーズが複数またがっていても
 * （＝タブが長時間バックグラウンドで眠っていた場合）、1つずつ辿って正しい終着点を返す。
 * 強制的に0扱いにしたり、フェーズを1回分しか進めなかったりしない。
 * @param {{phase:string, phaseEndAt:number, done:number, cfg:object, now?:number}} state
 * @param {number} [guard=ADVANCE_GUARD] 無限ループ防止（cfgの分数が壊れて0になっている等の異常系向け）
 * @returns {{phase:string, phaseEndAt:number, done:number, transitions:Array<{from:string,to:string,wasStudy:boolean}>}}
 */
export function advanceState({ phase, phaseEndAt, done, cfg, now = Date.now() }, guard = ADVANCE_GUARD) {
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

/**
 * 数字入力欄（PomoNumberField）のフォーカスが外れた時に行う確定処理の純粋部分。
 * 空文字・非数値ならvalue（直前の確定値）へ戻し、それ以外はmin〜maxへ丸める。
 * UIから切り出すことで、DOMテスト環境が無くてもふるまいを単体テストできるようにする。
 * @param {string} raw 入力欄の現在の文字列（draft）
 * @param {number} value 直前の確定値（非数値だった時のフォールバック）
 * @param {number} min
 * @param {number} max
 * @returns {{clamped:number, changed:boolean}} changed=true の時だけ呼び出し側はonCommitを呼ぶ
 */
export function clampDraftCommit(raw, value, min, max) {
  const n = parseInt(raw, 10);
  const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
  return { clamped, changed: clamped !== value };
}

/**
 * 表示用の残り秒数（running中はphaseEndAtから逆算、停止中はremainingをそのまま使う）。
 * @param {{running:boolean, phaseEndAt:number, remaining:number}} state
 * @param {number} [now=Date.now()]
 * @returns {number}
 */
export function remainingSecOf({ running, phaseEndAt, remaining }, now = Date.now()) {
  if (!running) return remaining;
  return Math.max(0, Math.ceil((phaseEndAt - now) / 1000));
}
