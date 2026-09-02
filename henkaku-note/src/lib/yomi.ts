// 読み（よみ）による並べ替えと あ〜ん / A〜Z 索引。
//
// 方針（誤読を出さないための約束。toc.spec.ts が機械チェックする）:
//   1. 漢字を含む項目は **必ず reading（ひらがな）を元データ側に明示する**。
//      **自動推定はしない**（読み間違いをそのまま索引に出さないため）。
//      読みが無ければ「その他」行に落として、入れ忘れが目に見えるようにする。
//   2. **数字は読みに変換してから行を決める**（「3のルール」→ さんのるーる → さ行）。
//      見た目の数字順で先頭に固めない。数字だけは機械的に読めるので面倒を見る。
//   3. 英数字混じり（WHO・Ⅰ型・①など）は normalizeAlnum で正規化してから A〜Z を判定する。
//
// **React に依存させない。** lib/ を素の JS/TS のままにしておくと、
// アプリの依存を入れていない状態でも試験できる。フックは components/ 側に置く。

const ONES = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const HYAKU: Record<number, string> = { 1: 'ひゃく', 3: 'さんびゃく', 6: 'ろっぴゃく', 8: 'はっぴゃく' };
const SEN: Record<number, string> = { 1: 'せん', 3: 'さんぜん', 8: 'はっせん' };

/** 0〜99999999 の読み（索引の並べ替え用。先頭のかなが合っていればよい） */
export function numberToReading(num: number | string): string {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'ぜろ';
  if (n >= 100000000) return numberToReading(Math.floor(n / 100000000)) + 'おく' + tail(n % 100000000);
  return tail(n);
}

function tail(n: number): string {
  if (n === 0) return '';
  if (n >= 10000) {
    const man = Math.floor(n / 10000);
    return under10000(man) + 'まん' + under10000(n % 10000);
  }
  return under10000(n);
}

function under10000(n: number): string {
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
export function kataToHira(s: string): string {
  return String(s).replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** 全角の英数字・記号→半角 */
export function toHalfWidth(s: string): string {
  return String(s).replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/**
 * 文字列中の数字をすべて読みに置き換える。
 * 例) '3のルール' → 'さんのルール'（先頭が「さ」＝さ行）
 *     '20歳未満'  → 'にじゅう歳未満'（な行。見た目の数字順で先頭に固めない）
 */
export function autoReading(text: string): string {
  return toHalfWidth(String(text)).replace(/[0-9]+/g, (d) => numberToReading(parseInt(d, 10)));
}

// ローマ数字・丸数字。英数字混じりの項目を A〜Z 判定へ乗せるために正規化する。
const ROMAN: Record<string, string> = {
  'Ⅰ': 'I', 'Ⅱ': 'II', 'Ⅲ': 'III', 'Ⅳ': 'IV', 'Ⅴ': 'V', 'Ⅵ': 'VI', 'Ⅶ': 'VII', 'Ⅷ': 'VIII', 'Ⅸ': 'IX', 'Ⅹ': 'X',
  'ⅰ': 'i', 'ⅱ': 'ii', 'ⅲ': 'iii', 'ⅳ': 'iv', 'ⅴ': 'v', 'ⅵ': 'vi', 'ⅶ': 'vii', 'ⅷ': 'viii', 'ⅸ': 'ix', 'ⅹ': 'x',
};
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

/**
 * 英数字混じりの項目を正規化する（A〜Z グループ判定の前処理）。
 * 全角→半角、ローマ数字→ラテン文字、丸数字→数字、記号と空白を落とす。
 * 例) 'ＷＨＯ' → 'WHO' / 'Ⅰ型' → 'I型' / '①仲間' → '1仲間'
 */
export function normalizeAlnum(s: string): string {
  let out = toHalfWidth(String(s || ''));
  out = out.replace(/[Ⅰ-Ⅹⅰ-ⅹ]/g, (c) => ROMAN[c] || c);
  out = out.replace(new RegExp(`[${CIRCLED}]`, 'g'), (c) => String(CIRCLED.indexOf(c) + 1));
  // 前後に付きがちな飾り（記号・空白）は判定の邪魔なので落とす
  const DECOR = '\\s　"\'“”「」『』（）()［］\\[\\]【】<>《》.,、。・:：;；!?！？*+#-';
  return out
    .replace(new RegExp(`^[${DECOR}]+`, 'u'), '')
    .replace(new RegExp(`[${DECOR}]+$`, 'u'), '')
    .trim();
}

// 濁点・半濁点・小書き・長音を清音の大書きへ寄せる（行の判定と検索用）
const FOLD: Record<string, string> = {
  が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ', ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
  だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と', ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ',
  ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ', ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お',
  っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ', ゐ: 'い', ゑ: 'え', ゔ: 'う',
};

/** 濁点・小書き・カタカナ・長音のゆれを寄せる（行の判定と検索の突き合わせに使う） */
export function foldKana(s: string): string {
  const hira = kataToHira(String(s || '')).replace(/ー/g, '');
  let out = '';
  for (const ch of hira) out += FOLD[ch] || ch;
  return out;
}

export const KANA_ROWS: [string, string][] = [
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

/** 索引の並び順（あ〜ん → A〜Z → その他） */
export const GROUP_ORDER: string[] = [...KANA_ROWS.map((r) => r[0]), LATIN_GROUP, OTHER_GROUP];

/** かな1文字 → 行ラベル（あ/か/…/わ）。かな以外は null */
export function kanaRow(ch: string): string | null {
  if (!ch) return null;
  const c = foldKana(ch)[0];
  if (!c) return null;
  for (const [label, set] of KANA_ROWS) if (set.includes(c)) return label;
  return null;
}

export interface ReadingInfo {
  group: string;
  key: string;
  reading: string;
}

/**
 * 項目 → { group, key, reading }
 *
 * 判定の順番（この順番に意味がある）:
 *   1. reading があればそれを使う（**漢字の読みは推定しない**）
 *   2. 無ければ normalizeAlnum で正規化し、ラテン文字で始まれば A〜Z
 *   3. それでもだめなら数字を読みに変換して（autoReading）かなの行を見る
 *   4. どれでもなければ「その他」（＝読みの入れ忘れが目に見える）
 */
export function readingInfo(title: string, reading = ''): ReadingInfo {
  if (reading) {
    const hira = foldKana(String(reading)).trim();
    if (/^[A-Za-z]/.test(hira)) return { group: LATIN_GROUP, key: hira.toLowerCase(), reading: String(reading) };
    const row = kanaRow(hira[0]);
    if (row) return { group: row, key: hira, reading: String(reading) };
    return { group: OTHER_GROUP, key: hira, reading: String(reading) };
  }
  const normalized = normalizeAlnum(title);
  if (/^[A-Za-z]/.test(normalized)) {
    return { group: LATIN_GROUP, key: normalized.toLowerCase(), reading: normalized };
  }
  const auto = foldKana(autoReading(normalized)).trim();
  const row = kanaRow(auto[0]);
  if (row) return { group: row, key: auto, reading: auto };
  return { group: OTHER_GROUP, key: auto || String(title || ''), reading: '' };
}

export interface KanaSection<T> {
  group: string;
  items: (T & ReadingInfo & { key: string })[];
}

/**
 * 項目の配列を あ〜ん / A〜Z / その他 のセクションに分ける。
 * 空のセクションは含まない。
 */
export function buildKanaIndex<T extends { title: string; reading?: string; sortKey?: string }>(
  items: T[] = [],
): KanaSection<T>[] {
  const buckets = new Map<string, (T & ReadingInfo & { key: string })[]>();
  for (const item of items) {
    const info = readingInfo(item.title, item.reading || '');
    // sortKey は「①②③…」のように表示順が意味を持つ項目のための並べ替え用の上書き。
    // **行（あ〜ん / A〜Z）の振り分けは常に読みで決まる。**
    const key = item.sortKey || info.key;
    const list = buckets.get(info.group) || [];
    list.push({ ...item, ...info, key });
    buckets.set(info.group, list);
  }
  const sections: KanaSection<T>[] = [];
  for (const group of GROUP_ORDER) {
    const list = buckets.get(group);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => a.key.localeCompare(b.key, 'ja') || a.title.localeCompare(b.title, 'ja'));
    sections.push({ group, items: list });
  }
  return sections;
}
