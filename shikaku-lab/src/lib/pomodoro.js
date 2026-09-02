// ポモドーロタイマー（画面の上に常設）の計算。**純関数だけ**を置く。
//
// 決めていること:
//  1. **残り時間は「終わる時刻」から毎回引き算して出す**（1秒ずつ減らす数え方をしない）。
//     タブを裏に回すとブラウザはタイマーを間引くので、減算方式だと戻った時に必ずズレる。
//  2. **連続日数を煽らない**（変革ノートと同じ）。出すのは「今日の本数」と「通算の本数」だけ。
//     連続を主役にすると、1日休んだ時にアプリごと開かなくなる。
//  3. 休憩を飛ばせる・伸ばせる（行き止まりを作らない）。決めた形に人を合わせない。
//  4. 音は端末の中で鳴らす（音声ファイルを持たない＝起動が速い／オフラインで動く）。

/** 1分（ミリ秒） */
export const MINUTE = 60 * 1000;

export const DEFAULT_POMODORO = {
  focusMin: 25,
  shortMin: 5,
  longMin: 15,
  longEvery: 4, // 集中を何本やったら長い休憩にするか
  sound: true,
  vibrate: true,
  autoNext: false, // 次の区間へ自動で進むか（既定は手で押す）
};

export const PHASES = {
  focus: { id: 'focus', label: '集中', icon: '🍅' },
  short: { id: 'short', label: '休憩', icon: '☕' },
  long: { id: 'long', label: '長い休憩', icon: '🛋' },
};

/** 区間の長さ（ミリ秒） */
export function phaseDuration(phase, settings = DEFAULT_POMODORO) {
  const s = { ...DEFAULT_POMODORO, ...settings };
  if (phase === 'short') return Math.max(1, s.shortMin) * MINUTE;
  if (phase === 'long') return Math.max(1, s.longMin) * MINUTE;
  return Math.max(1, s.focusMin) * MINUTE;
}

/**
 * 集中を1本終えた直後に来る休憩の種類。
 * doneCount は「これまでに終えた集中の本数（今終えたぶんを含む）」。
 */
export function breakAfter(doneCount, settings = DEFAULT_POMODORO) {
  const every = Math.max(1, Number(settings.longEvery) || DEFAULT_POMODORO.longEvery);
  return doneCount > 0 && doneCount % every === 0 ? 'long' : 'short';
}

/** 次に来る区間（集中→休憩→集中…） */
export function nextPhase(phase, doneCount, settings = DEFAULT_POMODORO) {
  return phase === 'focus' ? breakAfter(doneCount, settings) : 'focus';
}

/** 走らせ始める（endsAt を持つ。残りは常にここから引き算する） */
export function startTimer(phase, settings = DEFAULT_POMODORO, now = Date.now()) {
  return { phase, endsAt: now + phaseDuration(phase, settings), pausedRemain: null };
}

/** 一時停止（残りだけを覚え、endsAt は捨てる） */
export function pauseTimer(timer, now = Date.now()) {
  if (!timer || timer.pausedRemain != null) return timer;
  return { ...timer, endsAt: null, pausedRemain: Math.max(0, timer.endsAt - now) };
}

/** 再開（覚えた残りから終わる時刻を作り直す） */
export function resumeTimer(timer, now = Date.now()) {
  if (!timer || timer.pausedRemain == null) return timer;
  return { ...timer, endsAt: now + timer.pausedRemain, pausedRemain: null };
}

/** 残り時間（ミリ秒）。止まっている時は覚えた残りを返す */
export function remainMs(timer, now = Date.now()) {
  if (!timer) return 0;
  if (timer.pausedRemain != null) return Math.max(0, timer.pausedRemain);
  return Math.max(0, (timer.endsAt || 0) - now);
}

/** 走り終わったか（止めている間は終わらない） */
export function isFinished(timer, now = Date.now()) {
  if (!timer) return false;
  if (timer.pausedRemain != null) return timer.pausedRemain <= 0;
  return (timer.endsAt || 0) <= now;
}

/** 「25:00」の形。1時間を超えたら「1:05:00」 */
export function formatRemain(ms) {
  // 端数は切り上げ（切り捨てると「0:00」が2秒ぶん表示され、止まったように見える）
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

/** 端末の日付（YYYY-MM-DD）。**toISOString を使わない**（UTCに直ると日本時間の午前0時が前日になる） */
export function dayKey(at = Date.now()) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 集中を1本終えた記録を足す。
 * log は [{ day, count }] を新しい日が先頭。日ごとに1行だけ持つ（1本ずつ持つと際限なく増える）。
 */
export function addSession(log = [], at = Date.now()) {
  const day = dayKey(at);
  const rest = (log || []).filter((r) => r.day !== day);
  const today = (log || []).find((r) => r.day === day);
  return [{ day, count: (today?.count || 0) + 1 }, ...rest].slice(0, 400);
}

/** 今日の本数 */
export function todayCount(log = [], at = Date.now()) {
  const day = dayKey(at);
  return (log || []).find((r) => r.day === day)?.count || 0;
}

/** 通算の本数（連続日数は出さない） */
export function totalCount(log = []) {
  return (log || []).reduce((sum, r) => sum + (Number(r.count) || 0), 0);
}

/** 記録のある日数（「◯日やった」＝休んでも減らない数え方） */
export function activeDays(log = []) {
  return (log || []).filter((r) => (Number(r.count) || 0) > 0).length;
}

/** 今日の集中時間（分）。設定を変えた日もあるので、あくまで目安として出す */
export function todayMinutes(log = [], settings = DEFAULT_POMODORO, at = Date.now()) {
  return todayCount(log, at) * (Math.max(1, settings.focusMin) || DEFAULT_POMODORO.focusMin);
}
