// 音声メモ入力（企画書 Phase 2）— 施術中で手が離せない時に、話した内容をメモ欄へ入れる。
//
// ⚠ プライバシー方針の「明示的な例外」:
//   このアプリの保存は端末内のみ（storage.js）。ただしブラウザの音声認識
//   （Web Speech API）は、多くのブラウザで音声をブラウザ提供元のサーバへ送って
//   文字にする。つまり「マイクの音声だけ」は端末の外に出る可能性がある。
//   そのため既定はオフ（settings.voiceInput）にし、設定画面で仕組みを説明したうえで
//   利用者自身に選んでもらう。認識できた文字は他の入力と同じく端末内にだけ残る。
//
// このファイルは React に依存しない（判定・文字結合はテストできる形にしておく）。

export const VOICE_LANG = 'ja-JP';

/** 音声メモの仕組みと注意点（設定画面・ボタンの説明で共用する） */
export const VOICE_PRIVACY_NOTE =
  'マイクの音声は、ブラウザの音声認識サービス（提供元のサーバ）へ送られて文字に変換される場合があります。'
  + 'お客様のお名前や連絡先は話さないでください。変換された文字は、他の入力と同じくこの端末の中にだけ保存されます。';

/** ブラウザの音声認識クラス（未対応環境では null） */
export function getSpeechRecognition(win) {
  if (!win) return null;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

/** この端末・ブラウザで音声メモが使えるか */
export function isVoiceInputAvailable(win) {
  return Boolean(getSpeechRecognition(win));
}

/** 設定がオンで、かつ端末が対応している時だけ音声メモのボタンを出す */
export function canUseVoiceInput(win, settings = {}) {
  return Boolean(settings.voiceInput) && isVoiceInputAvailable(win);
}

const ASCII_WORD = /[A-Za-z0-9]/;
const JA_CLOSING = /[。、．，！？!?）」』】〉》]/;

/**
 * 認識できた文字を既存のメモへ足す。
 * 日本語はそのまま連結し、英数字どうしの境目だけ半角スペースを入れる
 * （「腰痛 の 張り」のように不要な空白でメモが読みにくくなるのを避けるため）。
 */
export function appendTranscript(existing, chunk) {
  const add = String(chunk ?? '').trim();
  if (!add) return String(existing ?? '');
  const base = String(existing ?? '');
  if (!base) return add;
  const last = base[base.length - 1];
  if (/\s/.test(last)) return base + add; // 改行・空白で終わっているならそのまま続ける
  if (JA_CLOSING.test(last)) return base + add;
  if (ASCII_WORD.test(last) && ASCII_WORD.test(add[0])) return `${base} ${add}`;
  return base + add;
}

/** 話している最中の途中経過を、確定済みのメモと合わせて表示するための文字列 */
export function previewTranscript(existing, interim) {
  return appendTranscript(existing, interim);
}

const ERROR_MESSAGES = {
  'not-allowed': 'マイクの使用が許可されていません。ブラウザの設定でこのサイトのマイクを「許可」にしてください。',
  'service-not-allowed': 'この環境では音声認識が使えません（ブラウザ側で制限されています）。キーボード入力をお使いください。',
  'audio-capture': 'マイクが見つかりませんでした。端末にマイクがあるか、他のアプリが使っていないか確認してください。',
  network: '音声認識サービスに接続できませんでした。電波の良い場所で試すか、キーボード入力をお使いください。',
  'no-speech': '声を聞き取れませんでした。もう一度、マイクに近づいてゆっくり話してください。',
  aborted: '音声入力を中止しました。',
  'language-not-supported': 'この端末では日本語の音声認識に対応していません。キーボード入力をお使いください。',
  'bad-grammar': '音声を文字にできませんでした。もう一度お試しください。',
};

/** 認識エラーを、施術中でも分かる日本語にする */
export function describeVoiceError(code) {
  const key = String(code || '');
  return ERROR_MESSAGES[key] || '音声入力でエラーが起きました。もう一度お試しください。';
}

/** エラーのうち「もう一度試せば直る」ものか（ボタンの出し方を変えるため） */
export function isRetryableVoiceError(code) {
  return code === 'no-speech' || code === 'aborted' || code === 'network' || code === 'bad-grammar';
}

/**
 * 音声認識のごく薄いラッパー。
 * ブラウザによってイベントの出方が違うので、扱いを1か所にまとめる。
 * @returns {{start:()=>void, stop:()=>void, abort:()=>void} | null} 未対応なら null
 */
export function createRecognizer(win, { lang = VOICE_LANG, onFinal, onInterim, onError, onEnd } = {}) {
  const Recognition = getSpeechRecognition(win);
  if (!Recognition) return null;
  const rec = new Recognition();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = true;

  rec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result[0] ? result[0].transcript : '';
      if (result.isFinal) {
        if (text && onFinal) onFinal(text);
      } else {
        interim += text;
      }
    }
    if (onInterim) onInterim(interim);
  };
  rec.onerror = (event) => {
    if (onError) onError(event && event.error ? event.error : '');
  };
  rec.onend = () => {
    if (onInterim) onInterim('');
    if (onEnd) onEnd();
  };

  return {
    start() {
      try {
        rec.start();
      } catch {
        // 二重startは無視（すでに聞き取り中）
      }
    },
    stop() {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    },
    abort() {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
    },
  };
}
