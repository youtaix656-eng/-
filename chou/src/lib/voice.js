// 記録の音声入力（提案30）。
//
// **このアプリの「端末の中だけ」という約束の、はっきりした例外です。**
// ブラウザの音声認識は、話した声を提供元のサーバーへ送って文字にする実装があります。
// だから既定はオフで、設定画面で理由を読んでから自分で選んでもらう形にしてあります
// （腰痛ナビ・Ouro と同じ扱い）。
//
// 決めていること
//  - **既定オフのオプトイン**（`settings.voiceInput`）。
//  - **使えない端末で使えるふりをしない**（`canListen()` が false ならボタンを出さない）。
//  - **勝手に録らない。** 押している間だけ動かし、離したら必ず止める。
//  - 文字にしたものは、いつもの入力欄に入るだけ（音そのものは保存しない）。

export function canListen() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * 1回ぶん聞き取る。`onText` に文字が来る。返り値の `stop()` で必ず止められる。
 * **失敗しても行き止まりにしない**——`onError` に日本語の一言を渡す。
 */
export function listenOnce({ onText, onError, onEnd, lang = 'ja-JP' } = {}) {
  if (!canListen()) {
    if (onError) onError('この端末では音声入力を使えません。');
    return { stop() {} };
  }
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  try {
    rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e && e.results && e.results[0] && e.results[0][0] ? e.results[0][0].transcript : '';
      if (text && onText) onText(String(text).trim());
    };
    rec.onerror = (e) => {
      const kind = e && e.error ? String(e.error) : '';
      if (onError) onError(errorLine(kind));
    };
    rec.onend = () => {
      if (onEnd) onEnd();
    };
    rec.start();
  } catch {
    if (onError) onError('音声入力を始められませんでした。');
    return { stop() {} };
  }
  return {
    stop() {
      try {
        rec.stop();
      } catch {
        /* もう止まっている */
      }
    },
  };
}

/** **英語の状態名をそのまま出さない**——次にすることが分かる日本語にする */
export function errorLine(kind) {
  if (kind === 'not-allowed' || kind === 'service-not-allowed') {
    return 'マイクの使用が許可されていません。ブラウザの設定から許可してください。';
  }
  if (kind === 'no-speech') return '声を拾えませんでした。もう一度押して話してください。';
  if (kind === 'audio-capture') return 'マイクが見つかりませんでした。';
  if (kind === 'network') return 'うまくつながりませんでした。文字で入力してください。';
  return 'うまく聞き取れませんでした。文字で入力してください。';
}

export const VOICE_OPT_IN_TITLE = '音声で入力する（既定はオフ）';

export const VOICE_OPT_IN_NOTE =
  'このアプリは、書いたものを端末の外へ出しません。ただし音声入力だけは例外です——'
  + 'ブラウザの音声認識は、話した声を提供元のサーバーへ送って文字にすることがあります。'
  + 'だから既定はオフで、理由を読んだうえで自分で選ぶ形にしてあります。'
  + '声そのものはこのアプリに残しません。文字になったものだけが、いつもの入力欄に入ります。';

export const VOICE_HELP =
  'ボタンを押して話すと、たべもの・ひとことの欄に文字が入ります。'
  + '聞き取りが違っていたら、そのまま手で直してください。';
