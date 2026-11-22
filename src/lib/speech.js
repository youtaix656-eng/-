// Web Speech API（speechSynthesis）による音声読み上げのラッパー
//
// アプリを開いた状態での再生を前提とする（画面OFF時の継続再生は非対応）。
// ファイル書き出しは行わず、アプリ内での再生のみ。

import { synthesizeSpeech } from './voiceClone.js';

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// 利用可能な音声一覧を取得（日本語を優先して返す）
export function getVoices() {
  if (!isSpeechSupported()) return [];
  return window.speechSynthesis.getVoices();
}

// 音声リストは非同期で読み込まれることがあるため、準備完了を待つ
export function loadVoices() {
  return new Promise((resolve) => {
    if (!isSpeechSupported()) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) return resolve(existing);
    const handler = () => {
      resolve(window.speechSynthesis.getVoices());
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handler);
    // フォールバック（voiceschanged が発火しない環境向け）
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
  });
}

// 読み上げ中の utterance を参照し続ける（参照が切れると Chrome がガベージコレクションで捨て、
// onend が二度と来ないまま再生が途中で止まることがある＝よく知られた不具合）。
const liveUtterances = new Set();

// 長い文を句点・読点で区切る（Chrome は1つの発話が長いと15秒前後で黙って打ち切ることがある）。
export const SPEECH_CHUNK_MAX = 120;
export function splitForSpeech(text, max = SPEECH_CHUNK_MAX) {
  const t = String(text || '').trim();
  if (!t) return [];
  if (t.length <= max) return [t];
  // 区切り記号のあとで切る（古い Safari が読めない後読みの正規表現は使わない）
  const parts = [];
  let cur = '';
  for (const ch of t) {
    cur += ch;
    if ('。．！？!?\n'.includes(ch)) { parts.push(cur); cur = ''; }
  }
  if (cur) parts.push(cur);
  const out = [];
  let buf = '';
  const push = (x) => { if (x.trim()) out.push(x.trim()); };
  for (const p of parts) {
    if (p.length > max) {
      push(buf); buf = '';
      // 句点の無い長い文は読点で、それでも長ければ文字数で切る
      let rest = p;
      while (rest.length > max) {
        const cut = rest.lastIndexOf('、', max);
        const at = cut > max * 0.4 ? cut + 1 : max;
        push(rest.slice(0, at));
        rest = rest.slice(at);
      }
      buf = rest;
    } else if ((buf + p).length > max) {
      push(buf); buf = p;
    } else buf += p;
  }
  push(buf);
  return out;
}

// 1つの発話を読み上げる（内部用）。onend が来ないまま止まった時の見張りつき。
function speakOne(text, { rate, pitch, volume, voice, signal }) {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = rate;
    u.pitch = pitch;
    u.volume = Math.max(0, Math.min(1, volume));
    if (voice) u.voice = voice;
    liveUtterances.add(u);

    let done = false;
    let watch = null;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      liveUtterances.delete(u);
      if (watch) clearInterval(watch);
      if (signal) signal.removeEventListener('abort', onAbort);
      fn(arg);
    };
    const onAbort = () => {
      synth.cancel();
      finish(reject, new DOMException('aborted', 'AbortError'));
    };

    u.onend = () => finish(resolve);
    u.onerror = (e) => {
      // cancel による中断は正常終了として扱う
      if (e.error === 'canceled' || e.error === 'interrupted') return finish(resolve);
      finish(reject, new Error('音声再生エラー: ' + e.error));
    };

    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort);
    }

    // 見張り：読み終わるはずの時間（1文字あたり約0.3秒÷速度＋余裕）を過ぎても終わりの知らせが
    // 来ず、しかも実際にはもう何も話していなければ、終わったものとして次へ進む（黙って止まらない）。
    const expectMs = (text.length * 300) / Math.max(0.3, rate || 1) + 6000;
    const startedAt = Date.now();
    watch = setInterval(() => {
      if (Date.now() - startedAt < expectMs) return;
      if (!synth.speaking && !synth.pending) finish(resolve);
      else if (Date.now() - startedAt > expectMs * 3) { synth.cancel(); finish(resolve); }
    }, 1000);

    if (synth.paused) synth.resume(); // 一時停止のまま固まっている時は戻してから話す
    synth.speak(u);
  });
}

// 1つのテキストを読み上げる Promise を返す。長い文は区切って順に読む。
export async function speak(text, { rate = 1, pitch = 1, volume = 1, voice = null, signal } = {}) {
  if (!isSpeechSupported()) throw new Error('speechSynthesis 未対応');
  if (!text || !text.trim()) return;
  for (const chunk of splitForSpeech(text)) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    await speakOne(chunk, { rate, pitch, volume, voice, signal });
  }
}

export function cancelSpeech() {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
export function pauseSpeech() {
  if (isSpeechSupported()) window.speechSynthesis.pause();
}
export function resumeSpeech() {
  if (isSpeechSupported()) window.speechSynthesis.resume();
}

// ---- ボイスクローン（BYOK・ElevenLabs）による読み上げ ----
// speak() と同じ Promise 契約（正常終了で resolve、abort で AbortError reject）に揃える。
let cloneAudioEl = null;
function ensureCloneAudioEl() {
  if (cloneAudioEl || typeof document === 'undefined') return cloneAudioEl;
  cloneAudioEl = document.createElement('audio');
  cloneAudioEl.style.display = 'none';
  document.body.appendChild(cloneAudioEl);
  return cloneAudioEl;
}

export async function speakCloned(text, { apiKey, voiceId, modelId, signal } = {}) {
  if (!text || !text.trim()) return;
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  const blob = await synthesizeSpeech({ apiKey, voiceId, text, modelId });
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
  const audio = ensureCloneAudioEl();
  if (!audio) return; // document が無い環境（テスト等）では何もしない
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    let done = false;
    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      URL.revokeObjectURL(url);
    };
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      cleanup();
      fn(arg);
    };
    const onEnded = () => finish(resolve);
    const onError = () => finish(reject, new Error('クローン音声の再生に失敗しました'));
    const onAbort = () => {
      audio.pause();
      finish(reject, new DOMException('aborted', 'AbortError'));
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort);
    }
    audio.src = url;
    audio.play().catch((e) => finish(reject, e));
  });
}

export function cancelClonedSpeech() {
  try {
    cloneAudioEl?.pause();
  } catch (e) {
    /* noop */
  }
}

// 中断可能な待機（音声の「間」に使用）
export function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new DOMException('aborted', 'AbortError'));
        },
        { once: true }
      );
    }
  });
}
