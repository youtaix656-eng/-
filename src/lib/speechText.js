// 読み上げる文を、声に出す直前にだけ整える（音声学習×連結学習・2026-11-23）。
// 画面に出す文字は変えない。React に依存しない純粋な関数だけを置く（node --test で確かめる）。
//
// 誤読の対策（対策案1〜10）：
//   ①言葉の読み（本人の手動補正 ＞ 経穴カードの読み ＞ よく誤読される言葉 ＞ 経絡・臓腑の読み）
//   ②記号（→ 〜 ⇔ ≒ ≦ ≧ ±）③丸数字・ローマ数字 ④英語の略語 ⑤単位 ⑥数の範囲・分数 ⑦○×
// 聞きやすさ（対策案16〜30）で使う小さな部品（文の区切り・問題の種類・経絡の流れ・寸の目安など）もここに置く。

// ---- 言葉の読み ----
// dict は [言葉, 読み] の配列。長い言葉から先に当てる（「腹通谷」を「通谷」より先に）。
// 1文字の言葉は、決まった一覧（singleOk）に載っているものだけ使う
// （「心」「肝」を文章中の全部に当てると「中心」「肝心」まで読みが変わるため）。
export function buildReadingDict({ cards = [], termReadings = {}, common = {}, userFixes = {}, singleOk = common } = {}) {
  const map = new Map();
  const put = (term, reading, allowSingle) => {
    if (!term || !reading || typeof term !== 'string' || typeof reading !== 'string') return;
    const t = term.trim();
    const r = reading.trim();
    if (!t || !r || t === r) return;
    if (t.length < 2 && !allowSingle) return;
    map.set(t, r);
  };
  // 弱い順に入れて、強いもので上書きする
  for (const [t, r] of Object.entries(termReadings || {})) put(t, r, false);
  for (const [t, r] of Object.entries(common || {})) put(t, r, Object.prototype.hasOwnProperty.call(singleOk || {}, t));
  for (const c of cards || []) put(c && c.name, c && c.yomi, false);
  for (const [t, r] of Object.entries(userFixes || {})) put(t, r, true);
  return Array.from(map.entries()).sort((a, b) => b[0].length - a[0].length);
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dictReCache = new WeakMap();
function dictRe(dict) {
  if (!dict || !dict.length) return null;
  let entry = dictReCache.get(dict);
  if (!entry) {
    entry = { re: new RegExp(dict.map(([t]) => escRe(t)).join('|'), 'g'), map: new Map(dict) };
    dictReCache.set(dict, entry);
  }
  return entry;
}

const KANJI = /[一-龥々〆ヶ]/;
// 長い言葉の一部に当たった時、漢字が1文字だけ取り残されるなら置き換えない
// （「上腕骨」の中の「腕骨」を置き換えると「上・わんこつ」、「膝関節」の「膝関」なら「しつかん・節」、
//   「加水分解」の「水分」なら「加・すいぶん・解」になり、かえって読みが壊れる。実データで確かめた）。
export function safeToReplace(str, offset, len) {
  let left = 0;
  for (let i = offset - 1; i >= 0 && KANJI.test(str[i]); i--) left++;
  let right = 0;
  for (let i = offset + len; i < str.length && KANJI.test(str[i]); i++) right++;
  // 「少海穴」「頸部側」「左少海」のように、あとに付く・前に付く決まった1文字だけなら置き換えてよい
  const okLeft = left === 1 && SAFE_PREFIX.includes(str[offset - 1]);
  const okRight = right === 1 && SAFE_SUFFIX.includes(str[offset + len]);
  return (left !== 1 || okLeft) && (right !== 1 || okRight);
}
const SAFE_PREFIX = '左右両各';
const SAFE_SUFFIX = '穴';

// 1回の置き換えで全部当てる（順に split/join すると、置き換えた読みの中にまた別の言葉が当たる）
export function applyReadingDict(text, dict) {
  const e = dictRe(dict);
  if (!e || !text) return text || '';
  e.re.lastIndex = 0;
  const str = String(text);
  return str.replace(e.re, (m, offset) => (safeToReplace(str, offset, m.length) ? (e.map.get(m) || m) : m));
}

// 文の中で、読みを直して読んでいる言葉を拾う（画面で「読みを直している言葉」を見せるため）
export function termsWithReading(text, dict, limit = 8) {
  const e = dictRe(dict);
  if (!e || !text) return [];
  const out = [];
  const seen = new Set();
  e.re.lastIndex = 0;
  let m;
  const str = String(text);
  while ((m = e.re.exec(str)) && out.length < limit) {
    if (!safeToReplace(str, m.index, m[0].length)) continue;
    if (!seen.has(m[0])) { seen.add(m[0]); out.push({ term: m[0], reading: e.map.get(m[0]) }); }
  }
  return out;
}

// ---- 記号 ----
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
const ROMAN_FULL = { Ⅰ: 1, Ⅱ: 2, Ⅲ: 3, Ⅳ: 4, Ⅴ: 5, Ⅵ: 6, Ⅶ: 7, Ⅷ: 8, Ⅸ: 9, Ⅹ: 10, Ⅺ: 11, Ⅻ: 12, ⅰ: 1, ⅱ: 2, ⅲ: 3, ⅳ: 4, ⅴ: 5, ⅵ: 6, ⅶ: 7, ⅷ: 8, ⅸ: 9, ⅹ: 10 };
const ROMAN_ASCII = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
// 英字のローマ数字は、後ろに「型・度・期」などが続く時だけ数字とみなす（ふつうの略語と区別するため）
const ROMAN_FOLLOW = '型|度|期|群|相|音|類|級|号|誘導|脳神経|神経|帯|層';

const LETTER = {
  A: 'エー', B: 'ビー', C: 'シー', D: 'ディー', E: 'イー', F: 'エフ', G: 'ジー', H: 'エイチ', I: 'アイ',
  J: 'ジェー', K: 'ケー', L: 'エル', M: 'エム', N: 'エヌ', O: 'オー', P: 'ピー', Q: 'キュー', R: 'アール',
  S: 'エス', T: 'ティー', U: 'ユー', V: 'ブイ', W: 'ダブリュー', X: 'エックス', Y: 'ワイ', Z: 'ゼット',
};
export const spellLetters = (s) => String(s).split('').map((ch) => LETTER[ch] || ch).join('');

// 単位（長いものから。「mmHg」を「mm」より先に）
const UNITS = [
  ['mmHg', '水銀柱ミリメートル'], ['cmH2O', '水柱センチメートル'], ['mEq/L', 'ミリ当量パーリットル'],
  ['mg/dL', 'ミリグラムパーデシリットル'], ['g/dL', 'グラムパーデシリットル'], ['mL/分', 'ミリリットル毎分'],
  ['kcal', 'キロカロリー'], ['μg', 'マイクログラム'], ['µg', 'マイクログラム'], ['μm', 'マイクロメートル'], ['µm', 'マイクロメートル'],
  ['mg', 'ミリグラム'], ['kg', 'キログラム'], ['mL', 'ミリリットル'], ['ml', 'ミリリットル'], ['dL', 'デシリットル'],
  ['cm', 'センチメートル'], ['mm', 'ミリメートル'], ['nm', 'ナノメートル'], ['Hz', 'ヘルツ'], ['kHz', 'キロヘルツ'],
  ['dB', 'デシベル'], ['℃', '度'], ['°C', '度'], ['㎎', 'ミリグラム'], ['㎏', 'キログラム'], ['㎖', 'ミリリットル'],
  ['㎝', 'センチメートル'], ['㎜', 'ミリメートル'],
];

export function readSymbols(text) {
  let t = String(text || '');
  // 丸数字 ①→1、
  t = t.replace(/[①-⑳]/g, (ch) => `、${CIRCLED.indexOf(ch) + 1}、`);
  // 全角のローマ数字はいつも数字に
  t = t.replace(/[Ⅰ-Ⅻⅰ-ⅹ]/g, (ch) => String(ROMAN_FULL[ch] || ch));
  // 英字のローマ数字（後ろに型・度…が続く時だけ）
  t = t.replace(new RegExp(`(^|[^A-Za-z])(XII|XI|IX|X|VIII|VII|VI|IV|V|III|II|I)(?=${ROMAN_FOLLOW})`, 'g'),
    (m, pre, r) => `${pre}${ROMAN_ASCII[r]}`);
  // 単位（数字のあと・スラッシュつきも）
  for (const [u, r] of UNITS) {
    t = t.replace(new RegExp(`(\\d|\\s|^|[^A-Za-z])${escRe(u)}(?![A-Za-z])`, 'g'), (m, pre) => `${pre}${r}`);
  }
  // 数の範囲・分数：2〜3 → 2から3、1/2 → 2分の1
  t = t.replace(/(\d+(?:\.\d+)?)\s*[〜～~]\s*(\d+(?:\.\d+)?)/g, '$1から$2');
  t = t.replace(/(^|[^\d/])(\d+)\/(\d+)(?![\d/])/g, (m, pre, a, b) => `${pre}${b}分の${a}`);
  // 数どうしの × はかける
  t = t.replace(/(\d)\s*[×✕]\s*(\d)/g, '$1かける$2');
  // 矢印・比べる記号
  t = t.replace(/[⇔↔⇄]/g, 'と、');
  // 「A→B→C」の並び（順番・流れ）が多いので「つぎに」と読む（「から」だと並びが意味を失う）
  t = t.replace(/[→⇒➡]/g, '、つぎに、');
  t = t.replace(/[←⇐]/g, 'へ、');
  t = t.replace(/[〜～]/g, 'から');
  t = t.replace(/≒/g, 'ほぼ').replace(/[≦≤]/g, '以下').replace(/[≧≥]/g, '以上').replace(/±/g, 'プラスマイナス');
  // ○×（○○のように2つ並ぶのは穴埋めの伏せ字なので、そのまま）
  t = t.replace(/(^|[^○])○(?!○)/g, '$1まる').replace(/(^|[^\d])[×✕](?!\d)/g, '$1ばつ');
  // 英字1文字＋数字（C5・T1・L4）→ シー5
  t = t.replace(/(^|[^A-Za-z])([A-Z])(\d+)/g, (m, pre, l, d) => `${pre}${LETTER[l]}${d}`);
  // 英語の略語（大文字2〜6文字）は1文字ずつ読む（WHO を「フー」と読ませない）
  t = t.replace(/(^|[^A-Za-z])([A-Z]{2,6})(?=[^A-Za-z]|$)/g, (m, pre, ab) => `${pre}${spellLetters(ab)}`);
  // 読点が重なった所・文頭の読点をならす
  t = t.replace(/[、，]{2,}/g, '、').replace(/([。（「(])、/g, '$1').replace(/^、/, '').replace(/、([。）」)])/g, '$1');
  return t;
}

// 誤読対策をまとめてかける（読みの辞書 → 記号）
export function toSpeechText(text, dict) {
  return readSymbols(applyReadingDict(text, dict));
}

// ---- 聞きやすさ ----
// 「左右・上下・前後」などの方向の言葉の前に一拍（対策案10）
export function pauseBeforeDirections(text) {
  return String(text || '').replace(/([^、。\s])(左右|上下|前後|内側|外側|左側|右側)/g, '$1、$2');
}

// 文を句点で区切る（対策案17）。短い文は1つにまとめたまま。
export function splitSentences(text, minLen = 40) {
  const t = String(text || '').trim();
  if (t.length < minLen) return [t];
  const parts = t.split('。').map((s) => s.trim()).filter(Boolean).map((s) => `${s}。`);
  return parts.length ? parts : [t];
}

// 体の向き・場所の言葉を、ふだんの言い方で補う（対策案19・21）。教科書の言葉は残し、あとに添える。
const BODY_WORDS = [
  ['橈側', '橈側、つまり親指がわ'], ['尺側', '尺側、つまり小指がわ'],
  ['内果', '内果、つまりうちくるぶし'], ['外果', '外果、つまりそとくるぶし'],
  ['示指', '示指、つまり人さし指'], ['環指', '環指、つまり薬指'], ['母指', '母指、つまり親指'],
  ['前正中線', '前正中線、つまり体の前の真ん中の線'], ['後正中線', '後正中線、つまり背中の真ん中の線'],
  ['脛骨稜', '脛骨稜、つまりすねの骨の前のかど'],
];
// 言葉のすぐあとに漢字が続く時（「長母指屈筋」「内果尖」）は、途中に割り込まないよう添えない
export function addBodyWords(text) {
  let t = String(text || '');
  for (const [w, r] of BODY_WORDS) {
    if (!t.includes(w) || t.includes(r)) continue;
    let out = '';
    let i = 0;
    let idx;
    while ((idx = t.indexOf(w, i)) >= 0) {
      const next = t[idx + w.length] || '';
      out += t.slice(i, idx) + (KANJI.test(next) ? w : r);
      i = idx + w.length;
    }
    t = out + t.slice(i);
  }
  return t;
}

// 寸の目安（対策案20）。同身寸法：1寸＝親指の幅、1寸5分＝人さし指と中指の2本ぶん、3寸＝指4本ぶん。
export const SUN_NOTE = '寸の目安は、1寸が親指の幅、1寸5分が人さし指と中指の2本ぶん、3寸が人さし指から小指までの4本ぶんの幅です。';
export const hasSun = (text) => /\d\s*寸|[一二三四五六七八九十半]寸/.test(String(text || ''));

// 経絡の流れ（対策案28）。流注の決まり：手の三陰＝胸から手へ、手の三陽＝手から頭へ、
// 足の三陽＝頭から足へ、足の三陰＝足から胸・腹へ。
const MERIDIAN_GROUP = {
  肺経: 'teIn', 心経: 'teIn', 心包経: 'teIn',
  大腸経: 'teYo', 小腸経: 'teYo', 三焦経: 'teYo',
  胃経: 'ashiYo', 膀胱経: 'ashiYo', 胆経: 'ashiYo',
  脾経: 'ashiIn', 腎経: 'ashiIn', 肝経: 'ashiIn',
};
const GROUP_FLOW = {
  teIn: '手の三陰経で、胸から手の指先へ流れます',
  teYo: '手の三陽経で、手の指先から頭へ流れます',
  ashiYo: '足の三陽経で、頭から足の指先へ流れます',
  ashiIn: '足の三陰経で、足の指先から腹・胸へ流れます',
};
export function meridianFlowText(text) {
  const t = String(text || '');
  // 長い名前から（「心包経」を「心経」より先に）
  const names = Object.keys(MERIDIAN_GROUP).sort((a, b) => b.length - a.length);
  for (const n of names) {
    const idx = t.indexOf(n);
    if (idx < 0) continue;
    return `${n}は、${GROUP_FLOW[MERIDIAN_GROUP[n]]}。`;
  }
  return '';
}

// 問題の種類を最初に言う（対策案25・26）。当てずっぽうにしないため、はっきり当たる言葉がある時だけ。
export function questionKindText(q) {
  if (!q || !q.question) return '';
  const s = q.question;
  if (q.type === 'ox') return '正しいか誤りかを答える問題です。';
  const parts = [];
  if (/誤っている|誤り|適切でない|正しくない|該当しない|含まれない|ないのは/.test(s)) parts.push('誤っているもの、当てはまらないものを選ぶ問題です。');
  else if (/組合せ|組み合わせ/.test(s)) parts.push('組み合わせを選ぶ問題です。');
  if (/部位|位置|どこ|取穴|存在する|ある経穴|に位置/.test(s)) parts.push('場所を思い浮かべる問題です。');
  else if (/何個|何本|何対|何歳|何日|何年|何寸|何％|何%|いくつ|何回|何倍|数値|割合|何人/.test(s)) parts.push('数字の問題です。');
  return parts.join('');
}

// 選択肢を短く（対策案24）：かっこの中の補足だけを外す（中身の言葉は削らない）
export const shortenChoice = (c) => String(c || '').replace(/（[^（）]*）|\([^()]*\)/g, '').trim() || String(c || '');

// 図の説明（対策案27）。図に描かれている内容だけを言葉にする（図に無いことは足さない）。
export const FIGURE_DESCRIPTIONS = {
  spine: '図の説明。脊柱を上下に5つに区切った図です。上の頭の側から順に、A、B、C、D、Eと並び、Bがいちばん長い区分です。',
  heart: '図の説明。心臓を前から見た図で、部屋が4つあります。上の2つが心房で、図の左上がア、右上がイ。下の2つが心室で、図の左下がウ、右下がエです。',
  'hand-goukoku': '図の説明。手の甲の図です。親指と人さし指の骨のあいだ、第1と第2の中手骨のあいだのくぼみに、赤い点があります。',
  'leg-sanri': '図の説明。右脚のすねを前から見た図です。膝の下で、すねの骨の前のかど、脛骨稜の外がわに、赤い点があります。',
  'pitching-phases': '図の説明。投球動作を4つの場面に分け、左から順に並べた図です。1つめの早期コッキング期は投げる腕が上を向き、2つめの後期コッキング期は腕を後ろへ大きく引き、3つめの加速期は腕を前へ振り出し、4つめのフォロースルー期は腕が前の下へ振り下ろされています。',
};
export const figureDescription = (q) => (q && q.figure ? FIGURE_DESCRIPTIONS[q.figure] || '' : '');

// 短く言い直す（対策案30）：正解と、解説の最初の1文だけ
export function shortRetellText(q) {
  if (!q) return '';
  const correct = Array.isArray(q.choices) ? q.choices[q.answer] : null;
  let t = '';
  if (correct != null && correct !== '') t += q.type === 'ox' ? `答えは、${correct}。` : `答えは、${correct}。`;
  const first = q.explanation ? String(q.explanation).split('。')[0] : '';
  if (first) t += `${first}。`;
  return t || '短く言い直せる内容がありません。';
}

// 文の中の漢字のかたまり（2〜8文字）を拾う（読み間違いの報告をワンタップにするため・対策案11）
export function kanjiWords(text, limit = 12) {
  const out = [];
  const seen = new Set();
  const re = /[一-龥々〆ヶ]{2,8}/g;
  let m;
  const s = String(text || '');
  while ((m = re.exec(s)) && out.length < limit) {
    if (!seen.has(m[0])) { seen.add(m[0]); out.push(m[0]); }
  }
  return out;
}
