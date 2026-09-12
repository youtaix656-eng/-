// タイマーの状態遷移（純粋関数。時計は読まない＝ now は必ず外から渡す）。
//
// ⚠ 残り時間は endAt から毎回引き算する。1秒ずつ減らす作りにすると、
//    タブが裏に回って止まった時に必ずズレる。
// ⚠ 自動で次へ進む時、次の局面は「今」ではなく「前の局面が終わった時刻」から始める。
//    裏で長く止まっていても、時間の流れが本物のまま繋がる（複数局面をまとめて追いつける）。

import type { Phase, Preset, SessionRecord, TimerState } from '../types/index.js';

export const MINUTE_MS = 60000;

export interface PhaseEvent {
  kind: 'completed' | 'skipped';
  phase: Phase;
  /** その局面を始めた時刻 */
  startedAt: number | null;
  /** 集中していた長さ（ms）。休憩では 0 */
  focusedMs: number;
  tag: string | null;
  /** 終わった（または飛ばした）時刻 */
  at: number;
}

export interface TickResult {
  state: TimerState;
  events: PhaseEvent[];
  /** 自動で次の局面が始まった回数（開始音を鳴らすかの判断に使う） */
  autoStarted: number;
}

export function phaseDurationMs(preset: Preset, phase: Phase): number {
  if (phase === 'focus') return preset.focusMinutes * MINUTE_MS;
  if (phase === 'short') return preset.shortBreakMinutes * MINUTE_MS;
  return preset.longBreakMinutes * MINUTE_MS;
}

export function phaseLabel(phase: Phase): string {
  if (phase === 'focus') return '集中中';
  if (phase === 'short') return '短い休憩';
  return '長い休憩';
}

/** 集中の直後に来る休憩の種類 */
export function breakAfter(pomoIndex: number, preset: Preset): Phase {
  return pomoIndex + 1 >= preset.sessionsCount ? 'long' : 'short';
}

export function initialTimer(preset: Preset, tag: string | null = null): TimerState {
  return {
    phase: 'focus',
    pomoIndex: 0,
    status: 'idle',
    endAt: null,
    remainingMs: phaseDurationMs(preset, 'focus'),
    durationMs: phaseDurationMs(preset, 'focus'),
    startedAt: null,
    tag,
  };
}

/** 次の局面を（まだ始めずに）用意する */
export function nextPhase(state: TimerState, preset: Preset): TimerState {
  let phase: Phase;
  let pomoIndex = state.pomoIndex;
  if (state.phase === 'focus') {
    phase = breakAfter(state.pomoIndex, preset);
  } else if (state.phase === 'short') {
    phase = 'focus';
    pomoIndex = state.pomoIndex + 1;
  } else {
    phase = 'focus';
    pomoIndex = 0;
  }
  const durationMs = phaseDurationMs(preset, phase);
  return { ...state, phase, pomoIndex, status: 'idle', endAt: null, remainingMs: durationMs, durationMs, startedAt: null };
}

export function remainingMs(state: TimerState, now: number): number {
  if (state.status === 'running' && state.endAt != null) return Math.max(0, state.endAt - now);
  return Math.max(0, state.remainingMs);
}

/** 0〜1。進んだ割合 */
export function progressOf(state: TimerState, now: number): number {
  if (state.durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remainingMs(state, now) / state.durationMs));
}

export function start(state: TimerState, now: number): TimerState {
  if (state.status === 'running') return state;
  const remaining = Math.max(0, state.remainingMs);
  const startedAt = state.startedAt ?? (state.phase === 'focus' ? now : null);
  return { ...state, status: 'running', endAt: now + remaining, startedAt };
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', endAt: null, remainingMs: remainingMs(state, now) };
}

export function setTag(state: TimerState, tag: string | null): TimerState {
  const t = tag && tag.trim() ? tag.trim().slice(0, 40) : null;
  return { ...state, tag: t };
}

function focusedMsOf(state: TimerState, now: number): number {
  if (state.phase !== 'focus') return 0;
  return Math.max(0, state.durationMs - remainingMs(state, now));
}

/** 今の局面を飛ばして次を用意する（自動では始めない） */
export function skip(state: TimerState, preset: Preset, now: number): { state: TimerState; event: PhaseEvent } {
  const event: PhaseEvent = {
    kind: 'skipped',
    phase: state.phase,
    startedAt: state.startedAt,
    focusedMs: focusedMsOf(state, now),
    tag: state.tag,
    at: now,
  };
  return { state: nextPhase(state, preset), event };
}

/**
 * 時計を進める。終わっていれば局面を閉じ、autoContinue なら次を「終わった時刻から」始める。
 * 裏で長く止まっていた場合は、複数の局面をまとめて追いつく（上限は安全のため 50 局面）。
 */
export function tick(state: TimerState, preset: Preset, autoContinue: boolean, now: number): TickResult {
  const events: PhaseEvent[] = [];
  let cur = state;
  let autoStarted = 0;
  let guard = 0;
  while (cur.status === 'running' && cur.endAt != null && cur.endAt <= now && guard < 50) {
    guard++;
    const endedAt = cur.endAt;
    events.push({
      kind: 'completed',
      phase: cur.phase,
      startedAt: cur.startedAt,
      focusedMs: cur.phase === 'focus' ? cur.durationMs : 0,
      tag: cur.tag,
      at: endedAt,
    });
    const next = nextPhase(cur, preset);
    if (autoContinue) {
      cur = start(next, endedAt);
      autoStarted++;
    } else {
      cur = next;
    }
  }
  return { state: cur, events, autoStarted };
}

/** 局面の出来事を記録にする（集中だけ。1分未満の飛ばしは残さない） */
export function recordOf(event: PhaseEvent, id: string, dateKeyOf: (at: number) => string): SessionRecord | null {
  if (event.phase !== 'focus') return null;
  const minutes = Math.round(event.focusedMs / MINUTE_MS);
  if (event.kind === 'skipped' && minutes < 1) return null;
  const startedAt = event.startedAt ?? event.at - event.focusedMs;
  return {
    id,
    date: dateKeyOf(startedAt),
    startedAt,
    durationMinutes: minutes,
    tag: event.tag,
    completed: event.kind === 'completed',
  };
}

/** プリセットを切り替えた時：走っていなければ新しい長さで組み直す */
export function applyPreset(state: TimerState, preset: Preset): TimerState {
  if (state.status === 'running') return state;
  const durationMs = phaseDurationMs(preset, state.phase);
  const pomoIndex = Math.min(state.pomoIndex, Math.max(0, preset.sessionsCount - 1));
  if (state.status === 'paused') {
    // 一時停止中は、進んだぶんを保ったまま長さだけ差し替える
    const elapsed = Math.max(0, state.durationMs - state.remainingMs);
    return { ...state, pomoIndex, durationMs, remainingMs: Math.max(0, durationMs - elapsed) };
  }
  return { ...state, pomoIndex, durationMs, remainingMs: durationMs };
}
