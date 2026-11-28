// Web Speech API（speechSynthesis）による音声読み上げのラッパー
//
// アプリを開いた状態での再生を前提とする（画面OFF時の継続再生は非対応）。
// ファイル書き出しは行わず、アプリ内での再生のみ。

import { synthesizeSpeech } from './voiceClone.js';

// アプリ版（Android の WebView）には speechSynthesis が無い。その時は Android 本体の
// 読み上げ（android/ の NativeTtsPlugin.kt）を使う。@capacitor/core は import しない
// （nativeBridge.js と同じく、実行時の window.Capacitor だけを見る）。
export function nativeTts() {
  try {
    if (typeof window === 'undefined') return null;
    const cap = window.Capacitor;
    if (!cap || typeof cap.isNativePlatform !== 'function' || !cap.isNativePlatform()) return null;
    return cap.Plugins?.NativeTts || null;
  } catch (e) {
    return null;
  }
}

function hasWebSpeech() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSpeechSupported() {
  return !!nativeTts() || hasWebSpeech();
}

// 端末の読み上げ（アプリ版）で日本語が読めない時の理由。読める・ブラウザ版なら null。
export async function nativeTtsProblem() {
  const p = nativeTts();
  if (!p || typeof p.isAvailable !== 'function') return null;
  try {
    const r = await p.isAvailable({});
    return r?.available ? null : r?.error || '端末の読み上げを使えません';
  } catch (e) {
    return e?.message || '端末の読み上げを使えません';
  }
}

// 端末の読み上げの設定を開く（アプリ版だけ）
export async function openNativeTtsSettings() {
  const p = nativeTts();
  if (!p || typeof p.openSettings !== 'function') return false;
  try { await p.openSettings({}); return true; } catch (e) { return false; }
}

// 利用可能な音声一覧を取得（日本語を優先して返す）。アプリ版は端末の読み上げの声を使うので空。
export function getVoices() {
  if (nativeTts() || !hasWebSpeech()) return [];
  return window.speechSynthesis.getVoices();
}

// 音声リストは非同期で読み込まれることがあるため、準備完了を待つ
export function loadVoices() {
  return new Promise((resolve) => {
    if (nativeTts() || !hasWebSpeech()) return resolve([]);
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
export const NATIVE_CHUNK_MAX = 600;
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

// アプリ版：Android 本体の読み上げで1つの文を読む。止められたら 'canceled' を返す。
function speakOneNative(p, text, { rate, pitch, volume, signal }) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      fn(arg);
    };
    const onAbort = () => {
      try { p.stop({}); } catch (e) { /* noop */ }
      finish(reject, new DOMException('aborted', 'AbortError'));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort);
    }
    // 見張り：端末の読み上げが終わりの知らせを返さないまま止まった時、黙って止まり続けない
    const expectMs = (text.length * 300) / Math.max(0.3, rate || 1) + 15000;
    const watch = setTimeout(() => {
      if (done) return;
      try { p.stop({}); } catch (e) { /* noop */ }
      finish(resolve);
    }, expectMs * 2);
    Promise.resolve(p.speak({ text, rate, pitch, volume: Math.max(0, Math.min(1, volume)) }))
      .then((r) => { clearTimeout(watch); finish(resolve, r?.canceled ? 'canceled' : undefined); })
      .catch((e) => {
        clearTimeout(watch);
        const err = new Error(e?.message || '読み上げに失敗しました');
        // 端末の読み上げそのものが使えない（日本語の音声データが無い等）。1問ずつ飛ばし続けないよう、呼び出し側で止める
        if (e?.code === 'unavailable') err.name = 'TtsUnavailable';
        finish(reject, err);
      });
  });
}

// 1つの発話を読み上げる（内部用）。onend が来ないまま止まった時の見張りつき。
function speakOne(text, { rate, pitch, volume, voice, signal }) {
  const p = nativeTts();
  if (p) return speakOneNative(p, text, { rate, pitch, volume, signal });
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
      // （長い文の続きの区切りは読まない：resolve に 'canceled' を返して speak() に知らせる）
      if (e.error === 'canceled' || e.error === 'interrupted') return finish(resolve, 'canceled');
      finish(reject, new Error('音声再生エラー: ' + e.error));
    };

    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort);
    }

    // 見張り：読み終わるはずの時間（1文字あたり約0.3秒÷速度＋余裕）を過ぎても終わりの知らせが
    // 来ず、しかも実際にはもう何も話していなければ、終わったものとして次へ進む（黙って止まらない）。
    const expectMs = (text.length * 300) / Math.max(0.3, rate || 1) + 6000;
    // 前の読み上げの後ろに並んでいる間は数えない（話し始めた時から数える）。並んで待つだけで
    // 「長すぎる」と判断して列ごと消してしまわないように。
    let startedAt = Date.now();
    u.onstart = () => { startedAt = Date.now(); };
    watch = setInterval(() => {
      if (Date.now() - startedAt < expectMs) return;
      // 画面を消している・裏に回っている間は判断しない（ブラウザが読み上げを止めているだけのことが
      // 多く、ここで「終わった」とすると聞いていない問題を次々に飛ばしてしまう）
      if (typeof document !== 'undefined' && document.hidden) return;
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
  // 端末の読み上げ（アプリ版）は長い文でも途中で打ち切らないので、大きめに区切る（区切りの間の小さな途切れを減らす）
  for (const chunk of splitForSpeech(text, nativeTts() ? NATIVE_CHUNK_MAX : SPEECH_CHUNK_MAX)) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const r = await speakOne(chunk, { rate, pitch, volume, voice, signal });
    // 止められた（cancelSpeech・別の読み上げに割り込まれた）時は、残りの区切りを読まない。
    // 以前は区切りごとに続きを話してしまい、止めたはずの長い解説が鳴り続けていた。
    if (r === 'canceled') return;
  }
}

export function cancelSpeech() {
  const p = nativeTts();
  if (p) {
    try { p.stop({}); } catch (e) { /* noop */ }
    return;
  }
  if (hasWebSpeech()) window.speechSynthesis.cancel();
}
// アプリ版の端末の読み上げには一時停止が無いので、止める（続きは呼び出し側が読み直す）
export function pauseSpeech() {
  if (nativeTts()) return cancelSpeech();
  if (hasWebSpeech()) window.speechSynthesis.pause();
}
export function resumeSpeech() {
  if (nativeTts()) return;
  if (hasWebSpeech()) window.speechSynthesis.resume();
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

// 中断可能な待機（音声の「間」に使用）。
// アプリ版は端末の読み上げの列の中で無音を取る（画面を消している間に WebView の setTimeout が
// 間引かれて、間が何十秒にも延びるのを防ぐ）。途中で読み上げが止められた（ポモドーロの
// カウントダウン等）時は、残りの時間だけふつうに待つ。
export function wait(ms, signal) {
  const p = nativeTts();
  if (p && typeof p.silence === 'function' && ms >= 200) return waitNative(p, ms, signal);
  return waitTimer(ms, signal);
}

function waitNative(p, ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const start = Date.now();
    let done = false;
    let watch = null;
    const onAbort = () => {
      clearTimeout(watch);
      if (done) return;
      done = true;
      try { p.stop({}); } catch (e) { /* noop */ }
      reject(new DOMException('aborted', 'AbortError'));
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    // 見張り：端末の読み上げが無音の終わりを知らせないまま止まった時（エンジンが切られた等）、
    // 間のあとも待ち続けて再生ごと止まらないよう、決めた時間＋5秒で先へ進む
    watch = setTimeout(() => fallback(), ms + 5000);
    const fallback = () => {
      clearTimeout(watch);
      if (done) return;
      done = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      const left = ms - (Date.now() - start);
      if (left <= 50) resolve();
      else waitTimer(left, signal).then(resolve, reject);
    };
    Promise.resolve(p.silence({ ms }))
      .then((r) => {
        if (r?.canceled) return fallback();
        clearTimeout(watch);
        if (done) return;
        done = true;
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      })
      .catch(fallback);
  });
}

function waitTimer(ms, signal) {
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
