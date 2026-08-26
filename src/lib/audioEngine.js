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
import { speak, cancelSpeech, wait, speakCloned, cancelClonedSpeech } from './speech.js';

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
const settings = { rate: 1, pitch: 1, gapSeconds: 2, voice: null, loop: false, cloneVoice: null };
// cloneVoice: { apiKey, voiceId } | null。設定されていればブラウザのspeechSynthesisの
// 代わりにボイスクローン（BYOK・ElevenLabs）で読み上げる（AudioMode.jsxのトグルで切替）。

let abort = null;
let running = false;
let sleepTimer = null;
let wakeLock = null;
let visInit = false;

// ---- バックグラウンド表示（メディアセッション＋無音キープアライブ） ----
// 再生中に無音トラックを鳴らし、ロック画面/通知に「再生中」を表示する。
// これにより他アプリへ切り替えても通知が残り、タブが破棄されにくくなる。
// （※ 端末を完全にバックグラウンド化した際の読み上げ継続はOS仕様に依存）
let silentAudio = null;
let silentSrc = null;

function makeSilentWav() {
  const sr = 8000;
  const n = sr; // 1秒
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < n; i++) bytes[44 + i] = 128; // 8bit PCM の無音
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

function ensureSilentAudio() {
  if (silentAudio || typeof document === 'undefined') return;
  if (!silentSrc) silentSrc = makeSilentWav();
  silentAudio = document.createElement('audio');
  silentAudio.src = silentSrc;
  silentAudio.loop = true;
  silentAudio.preload = 'auto';
  silentAudio.volume = 0.0001; // ほぼ無音（メディアセッション維持のため実際に再生）
  silentAudio.setAttribute('playsinline', '');
  silentAudio.style.display = 'none';
  try { document.body.appendChild(silentAudio); } catch (e) { /* noop */ }
}

function mediaLabels(d) {
  if (!d) return { title: '音声学習', artist: '鍼灸国試 対策アプリ' };
  if (d.kind === 'compare') return { title: `比較：${d.comp?.title || ''}`, artist: '音声学習' };
  if (d.kind === 'number') return { title: `数字：${d.num?.topic || ''}`, artist: '音声学習' };
  if (d.kind === 'summary' || d.kind === 'flashcard') return { title: d.keyword || '用語', artist: '音声学習' };
  const q = d.q;
  const title = (q && q.question) || d.keyword || '音声学習';
  return { title: title.length > 60 ? title.slice(0, 60) + '…' : title, artist: (q && q.subject) || '音声学習' };
}

function setupMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler('play', () => play());
    navigator.mediaSession.setActionHandler('pause', () => stop());
    navigator.mediaSession.setActionHandler('stop', () => stop());
    navigator.mediaSession.setActionHandler('nexttrack', () => skip(1));
    navigator.mediaSession.setActionHandler('previoustrack', () => skip(-1));
    navigator.mediaSession.playbackState = 'playing';
  } catch (e) {
    /* noop */
  }
  updateMediaMetadata();
}

function updateMediaMetadata() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof window === 'undefined' || !window.MediaMetadata) return;
  try {
    const { title, artist } = mediaLabels(state.display);
    navigator.mediaSession.metadata = new window.MediaMetadata({ title, artist, album: '鍼灸国試 対策アプリ' });
  } catch (e) {
    /* noop */
  }
}

function startKeepAlive() {
  ensureSilentAudio();
  try { silentAudio?.play().catch(() => {}); } catch (e) { /* noop */ }
  setupMediaSession();
}
function stopKeepAlive() {
  try { silentAudio?.pause(); } catch (e) { /* noop */ }
  try {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  } catch (e) { /* noop */ }
}

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
    if (step.say) {
      if (settings.cloneVoice?.apiKey && settings.cloneVoice?.voiceId) {
        await speakCloned(step.say, { apiKey: settings.cloneVoice.apiKey, voiceId: settings.cloneVoice.voiceId, signal });
      } else {
        await speak(step.say, { rate: settings.rate, pitch: settings.pitch, voice: settings.voice, signal });
      }
    }
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
  startKeepAlive(); // 再開時（スキップ等）も無音キープアライブ＆通知を維持
  emit({ playing: true });
  try {
    let i = start;
    while (running) {
      if (i >= plan.length) {
        if (settings.loop && plan.length > 0) i = 0;
        else break;
      }
      emit({ index: i, display: plan[i]?.display || null });
      updateMediaMetadata();
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
  startKeepAlive();
  emit({ started: true });
  const start = state.index < plan.length ? state.index : 0;
  runFrom(start);
}

export function stop() {
  releaseWakeLock();
  clearSleep();
  stopKeepAlive();
  running = false;
  if (abort) abort.abort();
  cancelSpeech();
  cancelClonedSpeech();
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
