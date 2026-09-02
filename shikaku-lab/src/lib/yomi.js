// 読み（よみ）による並べ替えと あ〜ん / A〜Z 索引。
// 目次・索引の共通ルール（全アプリ共通）をこのアプリでも同じ形で実装している。
//
// 方針（誤読を出さないための約束）:
//   1. 漢字を含む項目は **必ず reading（ひらがな）をデータ側に明示する**。
//      自動推定はしない（読み間違いをそのまま索引に出さないため）。
//      読みが無いものは「その他」に落ちる＝入れ忘れが目に見える。
//   2. **数字は読み方に変換して五十音へ振り分ける**（例「第4類」→ だいよんるい → た行）。
//      数字だけは機械的に読めるので autoReading が面倒を見る。
//   3. アルファベットで始まる項目は A〜Z の枠に入れる。
//
// 新しい項目を足す時も 1〜3 を守ること。toc.test.mjs が機械チェックする。
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

/** 全角数字→半角 */
export function toHalfWidthDigits(s) {
  return String(s).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/**
 * 文字列中の数字をすべて読みに置き換える。
 * 例) '20歳未満の方' → 'にじゅう歳未満の方'（先頭が「に」＝な行に入る）
 *     '2019年'      → 'にせんじゅうきゅう年'
 */
export function autoReading(text) {
  return toHalfWidthDigits(text).replace(/[0-9]+/g, (d) => numberToKana(parseInt(d, 10)));
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
 * 項目 → { group, key }
 * reading が与えられていればそれを使い、無ければ数字だけを読みに変換して判定する。
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
 * @param {Array<{title:string, reading?:string}>} items
 * @returns {Array<{group:string, items:Array}>} 空のセクションは含まない
 */
export function buildKanaIndex(items = []) {
  const buckets = new Map();
  for (const item of items) {
    const info = readingInfo(item.title, item.reading);
    // sortKey は「①②③…」のように表示順が意味を持つ項目のための並べ替え用の上書き。
    // 行（あ〜ん / A〜Z）の振り分けは常に reading で決まる。
    const key = item.sortKey || info.key;
    list_push(buckets, info.group, { ...item, ...info, key });
  }

  function list_push(map, group, value) {
    const list = map.get(group) || [];
    list.push(value);
    map.set(group, list);
  }
  const sections = [];
  for (const group of GROUP_ORDER) {
    const list = buckets.get(group);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => a.key.localeCompare(b.key, 'ja') || a.title.localeCompare(b.title, 'ja'));
    // 何行に入るかは読みで決まるが、行の中では sortKey が優先される
    sections.push({ group, items: list });
  }
  return sections;
}
