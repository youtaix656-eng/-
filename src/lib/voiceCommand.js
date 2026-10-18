// 音声コマンド認識（声で自己採点○/△/✕・次へ/前へ/止めて）。Web Speech API の
// SpeechRecognition を使う。ブラウザの音声認識はOSやブラウザによってサーバーへ
// 音声データを送る場合があるため、端末内保存方針の明示的な例外として、
// AudioMode.jsx の設定画面で理由を説明したうえで既定オフのオプトインにする
// （腰痛ナビ・腸の音声メモ入力と同じ扱い）。

export function isVoiceCommandSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

const GRADE_WORDS = {
  maru: ['まる', '○', 'マル', 'できた', 'わかった', 'オーケー'],
  sankaku: ['さんかく', '△', 'あいまい', 'びみょう'],
  batsu: ['ばつ', '✕', 'バツ', 'できない', 'わからない'],
};
const NAV_WORDS = {
  next: ['つぎ', '次へ', '次', 'ネクスト'],
  prev: ['まえ', '前へ', '前', 'もどって', '戻って'],
  stop: ['とめて', '止めて', 'ストップ', '停止'],
};

// 聞き取ったテキストから、自己採点（grade）か操作（nav）かを判定する。
// どれにも当たらなければnull（当たらなくても黙って無視するだけで、エラーにはしない）。
export function parseVoiceCommand(text) {
  const t = (text || '').trim();
  if (!t) return null;
  for (const [kind, words] of Object.entries(GRADE_WORDS)) {
    if (words.some((w) => t.includes(w))) return { type: 'grade', kind };
  }
  for (const [kind, words] of Object.entries(NAV_WORDS)) {
    if (words.some((w) => t.includes(w))) return { type: 'nav', kind };
  }
  return null;
}

// 1回だけ聞き取る。結果が出るか、無音でタイムアウトするとonResult/onErrorが呼ばれて終わる。
// 戻り値のstop()で途中でも止められる（問題が切り替わった時のクリーンアップ用）。
export function listenOnce({ onResult, onError, lang = 'ja-JP' } = {}) {
  if (!isVoiceCommandSupported()) return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec;
  try {
    rec = new Ctor();
  } catch (e) {
    onError?.(e);
    return null;
  }
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  let done = false;
  rec.onresult = (e) => {
    if (done) return;
    done = true;
    const text = e.results?.[0]?.[0]?.transcript || '';
    onResult?.(text);
  };
  rec.onerror = (e) => {
    if (done) return;
    done = true;
    onError?.(e);
  };
  rec.onend = () => {
    if (!done) {
      done = true;
      onError?.(new Error('no-speech'));
    }
  };
  try {
    rec.start();
  } catch (e) {
    onError?.(e);
    return null;
  }
  return { stop: () => { try { rec.stop(); } catch (e) { /* noop */ } } };
}
