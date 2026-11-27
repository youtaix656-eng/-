// 音声学習の「続きから」位置を、閉じる直前でも取りこぼさないための同期の控え（2026-11-15・ユーザー指定）。
// storage.js の保存（IndexedDB）は400msまとめてから書くので、問題が切り替わった直後に
// アプリを閉じると前の位置のまま残ることがある。localStorageは同期で書けるので、同じ内容を
// ここにも即時に残し、読み込み時は新しい方（at）を使う。端末内だけ。
import { mirrorToNative } from './nativeMirror.js';

export const AUDIO_PROGRESS_SYNC_KEY = 'shinkyu:audioProgressSync';

export function saveAudioProgressSync(p) {
  const raw = JSON.stringify(p);
  try { localStorage.setItem(AUDIO_PROGRESS_SYNC_KEY, raw); } catch { /* 書けなくても再生は続ける */ }
  mirrorToNative(AUDIO_PROGRESS_SYNC_KEY, raw); // アプリ版：急に閉じても残るよう端末にも書く（nativeMirror.js）
}

// 「最初から（リセット）」の時に同期の控えも消す（消さないと、開き直した時に
// IndexedDBより新しい控えとして古い続き・記録済みの印が戻ってきていた）
export function clearAudioProgressSync() {
  try { localStorage.removeItem(AUDIO_PROGRESS_SYNC_KEY); } catch { /* noop */ }
  mirrorToNative(AUDIO_PROGRESS_SYNC_KEY, null);
}

export function loadAudioProgressSync() {
  try {
    const raw = localStorage.getItem(AUDIO_PROGRESS_SYNC_KEY);
    const p = raw ? JSON.parse(raw) : null;
    return p && typeof p === 'object' && typeof p.index === 'number' ? p : null;
  } catch { return null; }
}

// 2つの保存のうち新しい方（純関数）
export function newerProgress(a, b) {
  const ok = (p) => p && typeof p === 'object' && typeof p.index === 'number';
  if (!ok(a)) return ok(b) ? b : null;
  if (!ok(b)) return a;
  return (Number(b.at) || 0) > (Number(a.at) || 0) ? b : a;
}

// id配列の短い署名（純関数）。件数が同じでも中身・順番が違えば別の値になる。
export function idsSignature(ids) {
  const arr = Array.isArray(ids) ? ids : [];
  let h = 2166136261;
  const str = arr.join('\u0001');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${arr.length}:${(h >>> 0).toString(36)}`;
}
