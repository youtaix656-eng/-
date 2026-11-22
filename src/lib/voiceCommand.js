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
// 「全部できた」等は"できた"を含むためGRADE_WORDS.maruより先に判定する必要がある（新規#9）。
const NAV_WORDS = {
  allDone: ['全部できた', '残り全部', 'ぜんぶできた', 'もう全部できた', '全部わかった'],
  next: ['つぎ', '次へ', '次', 'ネクスト'],
  prev: ['まえ', '前へ', '前', 'もどって', '戻って'],
  stop: ['とめて', '止めて', 'ストップ', '停止'],
  // 盲目の受験生からの改善提案#9（2026-11-14）：詳細設定アコーディオンを画面を見ずに
  // 開くための声コマンド（AudioMode.jsxのsetDetailSettingsOpen(true)へ配線）。
  openSettings: ['詳細設定を開いて', '詳細設定を開けて', '設定を開いて'],
  // M25（2026-11-14）：声コマンド「もう一度言う」。audioEngine.jsのskip(0)は現在位置を
  // 変えずに止めてから読み直すため、既存のskip関数をそのまま再利用できる（新しい
  // 読み直しの仕組みは作らない）。
  replay: ['もう一度言う', 'もう一度聞く', 'もう一回言って', 'リピート'],
};
// 盲目の受験生からの改善提案#7（2026-11-14）：問題番号バー（ドラッグ操作）の代わりに、
// 「53問目へ」のように数字＋「問目／番へ／問へ」で直接その番号へ飛べるようにする。
const SEEK_RE = /(\d+)\s*(?:問目|番へ|問へ)/;
const KANJI_SEEK_RE = /([〇零一二三四五六七八九十百千]+)\s*(?:問目|番へ|問へ)/;

export function toHalfDigits(t) {
  return String(t || '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

// 漢数字（〜9999）を数にする。読めなければNaN。
export function kanjiToNumber(str) {
  const D = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const U = { 十: 10, 百: 100, 千: 1000 };
  const s = String(str || '');
  if (!s) return NaN;
  // 「一二三」のように桁の字が無い並びは、そのまま数字の並びとして読む
  if (![...s].some((c) => U[c])) {
    if (![...s].every((c) => c in D)) return NaN;
    return Number([...s].map((c) => D[c]).join(''));
  }
  let total = 0;
  let cur = 0;
  for (const c of s) {
    if (c in D) cur = D[c];
    else if (U[c]) { total += (cur || 1) * U[c]; cur = 0; }
    else return NaN;
  }
  return total + cur;
}

// 聞き取ったテキストから、自己採点（grade）か操作（nav）か直接ジャンプ（seek）かを判定する。
// customWordsは本人が登録した言い回し（settings.voiceCommandWords、新規#7）。
// [{ word, type:'grade'|'nav', kind }] の形で、組み込みの言葉より先に判定する
// （本人が「分かった」等を追加登録した時、組み込みの言葉とぶつかっても本人の登録を優先する）。
// どれにも当たらなければnull（当たらなくても黙って無視するだけで、エラーにはしない）。
export function parseVoiceCommand(text, customWords = []) {
  const t = (text || '').trim();
  if (!t) return null;
  for (const c of customWords || []) {
    if (c.word && t.includes(c.word)) return { type: c.type, kind: c.kind };
  }
  // 音声認識は「５３問目」（全角）や「五十三問目」（漢数字）で返すことがある。以前は半角の数字しか
  // 拾えず、そのまま「目」→次へ…のような別の言葉にも当たらず黙って無視されていた。
  const seekMatch = toHalfDigits(t).match(SEEK_RE) || t.match(KANJI_SEEK_RE);
  if (seekMatch) {
    const n = /^\d+$/.test(seekMatch[1]) ? parseInt(seekMatch[1], 10) : kanjiToNumber(seekMatch[1]);
    if (Number.isFinite(n) && n >= 1) return { type: 'seek', n };
  }
  // allDoneは「できた」を含む言い回しなのでGRADE_WORDSより先に判定する。
  if (NAV_WORDS.allDone.some((w) => t.includes(w))) return { type: 'nav', kind: 'allDone' };
  for (const [kind, words] of Object.entries(GRADE_WORDS)) {
    if (words.some((w) => t.includes(w))) return { type: 'grade', kind };
  }
  for (const [kind, words] of Object.entries(NAV_WORDS)) {
    if (kind === 'allDone') continue;
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
