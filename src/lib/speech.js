// Web Speech API（speechSynthesis）による音声読み上げのラッパー
//
// アプリを開いた状態での再生を前提とする（画面OFF時の継続再生は非対応）。
// ファイル書き出しは行わず、アプリ内での再生のみ。

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

// 1つのテキストを読み上げる Promise を返す。
// controller に現在の utterance を登録し、外部から stop できるようにする。
export function speak(text, { rate = 1, pitch = 1, voice = null, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (!isSpeechSupported()) return reject(new Error('speechSynthesis 未対応'));
    if (!text || !text.trim()) return resolve();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = rate;
    u.pitch = pitch;
    if (voice) u.voice = voice;

    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      fn(arg);
    };
    const onAbort = () => {
      window.speechSynthesis.cancel();
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

    window.speechSynthesis.speak(u);
  });
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
