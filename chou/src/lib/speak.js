// 読み上げ（提案25）。
//
// 決めていること
//  - **音声ファイルを持たない**（README 決まり9）。端末に入っている音声合成に読ませるだけ。
//  - **既定はオフ**（`settings.speak`）。押したときにだけ話す。勝手に鳴らさない。
//  - **使えない端末で「使えるふり」をしない**（`canSpeak()` が false なら
//    ボタン自体を出さない）。
//  - 読み上げは端末の中だけで完結する（このアプリでは、話す内容をどこへも送らない）。
//    ※ ブラウザによっては合成の音声データを提供元から取りに行く実装があるため、
//      **既定オフのままにしておく**。

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** 読ませる文にする。**印（`**`）や記号だけの行を読ませない** */
export function toSpeech(text) {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/[#>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let current = null;

export function speak(text, { rate = 1, lang = 'ja-JP' } = {}) {
  if (!canSpeak()) return false;
  const body = toSpeech(text);
  if (!body) return false;
  stopSpeaking();
  try {
    const u = new SpeechSynthesisUtterance(body);
    u.lang = lang;
    u.rate = rate;
    current = u;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  if (!canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* 使えない端末では黙って何もしない */
  }
  current = null;
}

export function isSpeaking() {
  return Boolean(current);
}

export const SPEAK_NOTE =
  '端末に入っている音声で読み上げます。音声ファイルは持っていません。'
  + '止めたいときはもう一度押してください。';
