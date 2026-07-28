// ============================================================
// 音声学習用の読み上げヘルパー（ブラウザ標準の音声合成 = Web Speech API）
//
// ※ この機能は端末・ブラウザに内蔵された音声合成を使っています。
//   クラウドのAI音声サービスではなく、外部通信なしで動作します
//   （オフラインPWAの方針に合わせるため）。日本語の音声が入っている
//   端末であれば自動で選ばれ、聞き取りやすいようやや遅めの速度で再生します。
// ============================================================

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** 日本語の音声があれば優先的に選ぶ */
function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const ja = voices.find((v) => v.lang?.toLowerCase().startsWith("ja"));
  return ja ?? voices[0] ?? null;
}

export type SpeechQueueHandle = {
  stop: () => void;
  pause: () => void;
  resume: () => void;
};

/**
 * テキストの配列を順番に読み上げる。
 * onIndexChange(i) で「今どの文を読んでいるか」を通知、
 * onEnd() で全文読み終わったときに呼ばれる。
 */
export function speakQueue(
  texts: string[],
  handlers: {
    onIndexChange?: (index: number) => void;
    onEnd?: () => void;
  } = {}
): SpeechQueueHandle {
  const synth = window.speechSynthesis;
  synth.cancel(); // 既存の読み上げをクリア

  const voice = pickJapaneseVoice();
  let cancelled = false;

  function speakAt(i: number) {
    if (cancelled) return;
    if (i >= texts.length) {
      handlers.onEnd?.();
      return;
    }
    handlers.onIndexChange?.(i);
    const utter = new SpeechSynthesisUtterance(texts[i]);
    utter.lang = "ja-JP";
    utter.rate = 0.95; // 聞き取りやすいようやや遅め
    utter.pitch = 1.0;
    if (voice) utter.voice = voice;
    utter.onend = () => speakAt(i + 1);
    utter.onerror = () => speakAt(i + 1); // 1文失敗しても止まらず次へ
    synth.speak(utter);
  }

  speakAt(0);

  return {
    stop: () => {
      cancelled = true;
      synth.cancel();
    },
    pause: () => synth.pause(),
    resume: () => synth.resume(),
  };
}
