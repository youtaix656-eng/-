// 勉強中BGMの再生（端末内の音声だけ）。
// ⚠ 呼び出し側が「イヤホンの確認が取れているか」を必ず見てから play() する。
//    このモジュール自身は判断しない（判断を2か所に持たない）。
// 音声は <audio> を1つだけ持ち、ループで流す。ロック画面の操作は mediaSession に登録する。

import { readBlob } from './storage.js';

let audio: HTMLAudioElement | null = null;
let currentId: string | null = null;
let objectUrl: string | null = null;

function element(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
  }
  return audio;
}

function releaseUrl() {
  if (objectUrl) {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      /* 解放できなくても続けられる */
    }
    objectUrl = null;
  }
}

/** 曲を読み込む（同じ曲なら何もしない）。無い時は false */
export async function load(id: string | null): Promise<boolean> {
  const el = element();
  if (!el) return false;
  if (id === currentId) return id != null;
  el.pause();
  releaseUrl();
  currentId = id;
  if (id == null) {
    el.removeAttribute('src');
    return false;
  }
  const blob = await readBlob(id);
  if (!blob) {
    currentId = null;
    return false;
  }
  objectUrl = URL.createObjectURL(blob);
  el.src = objectUrl;
  return true;
}

export function setVolume(v: number) {
  const el = element();
  if (el) el.volume = Math.min(1, Math.max(0, v));
}

export async function play(): Promise<boolean> {
  const el = element();
  if (!el || currentId == null) return false;
  try {
    await el.play();
    return true;
  } catch {
    return false; // 自動再生の制限など。タイマーは止めない
  }
}

export function pause() {
  const el = element();
  if (el && !el.paused) el.pause();
}

export function isPlaying(): boolean {
  const el = element();
  return !!el && !el.paused && currentId != null;
}

export function loadedId(): string | null {
  return currentId;
}

/** 追加する時に長さを読む（読めなければ null） */
export function probeDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof Audio === 'undefined') return resolve(null);
    const url = URL.createObjectURL(blob);
    const probe = new Audio();
    const done = (v: number | null) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* noop */
      }
      resolve(v);
    };
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : null);
    probe.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    probe.src = url;
  });
}

/** ロック画面・イヤホンのボタンから操作できるようにする */
export function setMediaSession(handlers: { title: string; artist: string; onPlay: () => void; onPause: () => void; onNext: () => void }) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title: handlers.title, artist: handlers.artist, album: 'EarPomo' });
    ms.setActionHandler('play', handlers.onPlay);
    ms.setActionHandler('pause', handlers.onPause);
    ms.setActionHandler('nexttrack', handlers.onNext);
  } catch {
    /* 対応していない端末では何もしない */
  }
}

export function setMediaPlaybackState(playing: boolean) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  } catch {
    /* noop */
  }
}
