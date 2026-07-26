// 音声再生エンジン（モジュールシングルトン）
//
// 画面（ビュー）を切り替えても再生が途切れないよう、再生ループを
// React コンポーネントの外（モジュール）に置く。AudioMode は「読み上げ計画
// （steps＋display）」を作ってこのエンジンに load し、再生・停止・スキップを
// 指示するだけ。ミニプレーヤーはどの画面からでもこのエンジンの状態を購読して表示する。
//
// ※ 端末の画面OFFやブラウザのバックグラウンド化では、OSの仕様で
//    Web Speech API が停止する（アプリ内での画面遷移のみ継続可能）。

import { useSyncExternalStore } from 'react';
import { speak, cancelSpeech, wait } from './speech.js';

const listeners = new Set();
let state = {
  playing: false,
  started: false, // 一度でも再生を始めたか（ミニプレーヤー表示の判定に使用）
  index: 0,
  phase: 'question',
  total: 0,
  hasPlan: false,
  display: null,
  planSig: null,
};

let plan = []; // [{ steps:[{phase, say?, wait?(ms), waitGap?:true|'cap2'}], display }]
const settings = { rate: 1, gapSeconds: 2, voice: null, loop: false };

let abort = null;
let running = false;
let sleepTimer = null;
let wakeLock = null;
let visInit = false;

function emit(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getSnapshot() {
  return state;
}

export function configure(patch) {
  Object.assign(settings, patch);
}
export function getSettings() {
  return { ...settings };
}

// 読み上げ計画を読み込む。sig が現在と同じなら（＝画面再表示など）何もしない。
export function load(newPlan, { sig = null, startIndex = 0 } = {}) {
  if (sig != null && sig === state.planSig) return; // 同一計画：再生位置を保つ
  stop();
  plan = newPlan || [];
  const i = plan.length ? Math.min(Math.max(0, startIndex), plan.length - 1) : 0;
  emit({
    planSig: sig,
    total: plan.length,
    hasPlan: plan.length > 0,
    index: i,
    display: plan[i]?.display || null,
    phase: 'question',
    started: false,
  });
}

async function playOne(item, signal) {
  const steps = item?.steps || [];
  for (const step of steps) {
    if (signal.aborted) return;
    if (step.phase) emit({ phase: step.phase });
    if (step.say) await speak(step.say, { rate: settings.rate, voice: settings.voice, signal });
    if (step.wait) await wait(step.wait, signal);
    if (step.waitGap) {
      const g = step.waitGap === 'cap2' ? Math.min(settings.gapSeconds, 2) : settings.gapSeconds;
      await wait(g * 1000, signal);
    }
  }
}

async function runFrom(start) {
  const controller = new AbortController();
  abort = controller;
  const signal = controller.signal;
  running = true;
  emit({ playing: true });
  try {
    let i = start;
    while (running) {
      if (i >= plan.length) {
        if (settings.loop && plan.length > 0) i = 0;
        else break;
      }
      emit({ index: i, display: plan[i]?.display || null });
      await playOne(plan[i], signal);
      i += 1;
    }
    if (!settings.loop && i >= plan.length && running) {
      stop();
      emit({ index: 0, phase: 'question', display: plan[0]?.display || null, started: false });
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.warn('audio engine error', e);
  }
}

export function play() {
  if (!plan.length) return;
  requestWakeLock();
  initVisibility();
  emit({ started: true });
  const start = state.index < plan.length ? state.index : 0;
  runFrom(start);
}

export function stop() {
  releaseWakeLock();
  clearSleep();
  running = false;
  if (abort) abort.abort();
  cancelSpeech();
  emit({ playing: false });
}

export function toggle() {
  if (state.playing) stop();
  else play();
}

export function skip(delta) {
  const wasPlaying = running;
  stop();
  const n = Math.max(0, Math.min(plan.length - 1, state.index + delta));
  emit({ index: n, phase: 'question', display: plan[n]?.display || null });
  if (wasPlaying) setTimeout(() => runFrom(n), 120);
}

export function resetToStart() {
  stop();
  emit({ index: 0, phase: 'question', display: plan[0]?.display || null, started: false });
}

export function setSleep(min) {
  clearSleep();
  if (running && min > 0) sleepTimer = setTimeout(() => stop(), min * 60 * 1000);
}

function clearSleep() {
  if (sleepTimer) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
  }
}

async function requestWakeLock() {
  try {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => {
        wakeLock = null;
      });
    }
  } catch (e) {
    /* 継続 */
  }
}
function releaseWakeLock() {
  try {
    wakeLock?.release();
  } catch (e) {
    /* noop */
  }
  wakeLock = null;
}
function initVisibility() {
  if (visInit || typeof document === 'undefined') return;
  visInit = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && running) requestWakeLock();
  });
}

// React 用フック
export function useAudioEngine() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
