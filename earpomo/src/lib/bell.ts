// 開始音・終了音。**音声ファイルを持たない**（端末の中でその場に作る）。
// ⚠ イヤホンの確認が取れていない時は呼ばない（呼び出し側が audioAllowed を見る）。
// 鳴らせない環境（自動再生の制限・古い端末）では黙って諦める＝落とさない。

import type { SoundId } from '../types/index.js';

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 最初のタップの中で呼び、以降の音を出せるようにしておく */
export function unlockAudio(): void {
  context();
}

function tone(c: AudioContext, type: OscillatorType, freq: number, at: number, len: number, peak: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + len + 0.05);
}

export function playSound(id: SoundId): void {
  if (id === 'none') return;
  const c = context();
  if (!c) return;
  try {
    const t = c.currentTime;
    if (id === 'bell') tone(c, 'sine', 880, t, 1.4, 0.2);
    else if (id === 'soft') tone(c, 'sine', 330, t, 1.8, 0.18);
    else if (id === 'wood') tone(c, 'triangle', 620, t, 0.18, 0.25);
    else if (id === 'chime') {
      tone(c, 'sine', 660, t, 0.9, 0.16);
      tone(c, 'sine', 990, t + 0.35, 1.2, 0.16);
    }
  } catch {
    /* 鳴らなくてもタイマー自体は動く */
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    /* 対応していない端末では何もしない */
  }
}
