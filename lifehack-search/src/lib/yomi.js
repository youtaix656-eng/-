// 読み（よみ）による並べ替えと あ〜ん / A〜Z 索引。
//
// 目次・索引の共通ルール（全アプリ共通）の実装:
//   1. 並びは「あ〜ん」→「A〜Z」。読み（ひらがな）で並べ替える。
//   2. 数字も読み方で振り分ける（例「3分ルール」→ さんぷん… → さ行）。
//   3. **漢字の読みは絶対に推定しない**。読みが無ければ「その他」に出して入れ忘れを見えるようにする。
//   4. タイトルは重複させない（toc.test.mjs が機械チェックする）。
//
// 数字だけは機械的に読めるので autoReading が面倒を見る。

const ONES = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const HYAKU = { 1: 'ひゃく', 3: 'さんびゃく', 6: 'ろっぴゃく', 8: 'はっぴゃく' };
const SEN = { 1: 'せん', 3: 'さんぜん', 8: 'はっせん' };

/** 0〜99999999 の読み（索引の並べ替え用。先頭のかなが合っていればよい） */
export function numberToKana(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'ぜろ';
  if (n >= 100000000) return numberToKana(Math.floor(n / 100000000)) + 'おく' + tail(n % 100000000);
  return tail(n);
}

function tail(n) {
  if (n === 0) return '';
  if (n >= 10000) {
    const man = Math.floor(n / 10000);
    return under10000(man) + 'まん' + under10000(n % 10000);
  }
  return under10000(n);
}

function under10000(n) {
  if (n === 0) return '';
  const th = Math.floor(n / 1000) % 10;
  const hu = Math.floor(n / 100) % 10;
  const te = Math.floor(n / 10) % 10;
  const on = n % 10;
  let s = '';
  if (th) s += SEN[th] || ONES[th] + 'せん';
  if (hu) s += HYAKU[hu] || ONES[hu] + 'ひゃく';
  if (te) s += te === 1 ? 'じゅう' : ONES[te] + 'じゅう';
  if (on) s += ONES[on];
  return s;
}

/** カタカナ→ひらがな */
export function kataToHira(s) {
  return String(s).replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** 全角英数・記号→半角 */
export function toHalfWidth(s) {
  return String(s).replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
}

/** 文字列中の数字をすべて読みに置き換える（例「3分」→「さんぷん」ではなく「さん分」で十分＝先頭のかなが合えばよい） */
export function autoReading(text) {
  return toHalfWidth(text).replace(/[0-9]+/g, (d) => numberToKana(parseInt(d, 10)));
}

// 濁点・小書きを清音・大書きに寄せる（行の判定用）
const FOLD = {
  が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ', ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
  だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と', ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ',
  ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ', ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お',
  っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ', ゐ: 'い', ゑ: 'え', ヴ: 'う',
};

export const KANA_ROWS = [
  ['あ', 'あいうえお'],
  ['か', 'かきくけこ'],
  ['さ', 'さしすせそ'],
  ['た', 'たちつてと'],
  ['な', 'なにぬねの'],
  ['は', 'はひふへほ'],
  ['ま', 'まみむめも'],
  ['や', 'やゆよ'],
  ['ら', 'らりるれろ'],
  ['わ', 'わをん'],
];

export const LATIN_GROUP = 'A〜Z';
export const OTHER_GROUP = 'その他';

/** かな1文字 → 行ラベル（あ/か/…/わ）。かな以外は null */
export function rowOf(ch) {
  const c = FOLD[ch] || ch;
  for (const [label, set] of KANA_ROWS) if (set.includes(c)) return label;
  return null;
}

/**
 * 項目 → { group, key, reading }
 * reading が与えられていればそれを使い、無ければ数字だけを読みに変換して判定する。
 * 漢字が残っていれば行が決まらないので「その他」に落ちる（＝読みの入れ忘れが見える）。
 */
export function readingInfo(title, reading = '') {
  const source = reading ? String(reading) : autoReading(String(title || ''));
  const hira = kataToHira(source).trim();
  if (/^[A-Za-z]/.test(hira)) {
    return { group: LATIN_GROUP, key: hira.toLowerCase(), reading: hira };
  }
  const group = rowOf(hira[0]);
  if (group) return { group, key: hira, reading: hira };
  return { group: OTHER_GROUP, key: hira, reading: hira };
}

/** 索引の並び順（あ〜わ → A〜Z → その他） */
export const GROUP_ORDER = [...KANA_ROWS.map((r) => r[0]), LATIN_GROUP, OTHER_GROUP];

/**
 * 項目の配列を あ〜ん / A〜Z のセクションに分ける。
 * @param {Array<{title:string, reading?:string, sortKey?:string}>} items
 * @returns {Array<{group:string, items:Array}>} 空のセクションは含まない
 */
export function buildKanaIndex(items = []) {
  const buckets = new Map();
  for (const item of items) {
    const info = readingInfo(item.title, item.reading);
    const key = item.sortKey || info.key;
    const list = buckets.get(info.group) || [];
    list.push({ ...item, ...info, key });
    buckets.set(info.group, list);
  }
  const sections = [];
  for (const group of GROUP_ORDER) {
    const list = buckets.get(group);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => a.key.localeCompare(b.key, 'ja') || a.title.localeCompare(b.title, 'ja'));
    sections.push({ group, items: list });
  }
  return sections;
}
