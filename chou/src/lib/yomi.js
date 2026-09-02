// 読み（ひらがな）の扱い。**React に依存させない・外部ライブラリを使わない**
// （素の JS のままテストできるようにするため。鏡・Ouro と同じ線）。
//
// 目次・索引の共通ルール（全アプリ共通）をここで実装する：
//  1. 並びは「あ〜ん」→「A〜Z」→「その他」。読み（ひらがな）で並べ替える。
//  2. **数字は読みに直してから行を決める**（見た目の数字順で先頭に固めない）。
//     例「7段階」→ ななだんかい → な行、「361穴」→ さんびゃく… → さ行。
//  3. **読みは自動推定しない。** データが読みを持たなければ「その他」へ落とし、
//     入れ忘れが目に見えるようにする（漢字の読みを機械が当てると必ず間違える）。
//  4. 英数字混じり（FODMAP・Ⅰ型 など）は**正規化してから** A〜Z を判定する。

/** 五十音の並び（この順が単一の正） */
const GOJUON = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';

/** 行の見出しと、その行に入る清音 */
export const KANA_ROWS = [
  { id: 'a', label: 'あ', chars: 'あいうえお' },
  { id: 'ka', label: 'か', chars: 'かきくけこ' },
  { id: 'sa', label: 'さ', chars: 'さしすせそ' },
  { id: 'ta', label: 'た', chars: 'たちつてと' },
  { id: 'na', label: 'な', chars: 'なにぬねの' },
  { id: 'ha', label: 'は', chars: 'はひふへほ' },
  { id: 'ma', label: 'ま', chars: 'まみむめも' },
  { id: 'ya', label: 'や', chars: 'やゆよ' },
  { id: 'ra', label: 'ら', chars: 'らりるれろ' },
  { id: 'wa', label: 'わ', chars: 'わをん' },
];

export const ALPHA_ROWS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => ({
  id: `alpha-${c}`,
  label: c,
  chars: c,
}));

export const OTHER_ROW = { id: 'other', label: 'その他', chars: '' };

/** 濁点・半濁点・小書き・カタカナ → 清音のひらがな へ寄せるための対応表 */
const FOLD_PAIRS = [
  ['がぎぐげご', 'かきくけこ'],
  ['ざじずぜぞ', 'さしすせそ'],
  ['だぢづでど', 'たちつてと'],
  ['ばびぶべぼ', 'はひふへほ'],
  ['ぱぴぷぺぽ', 'はひふへほ'],
  ['ぁぃぅぇぉ', 'あいうえお'],
  ['ゃゅょ', 'やゆよ'],
  ['っ', 'つ'],
  ['ゎ', 'わ'],
  ['ゐゑ', 'いえ'],
  ['ゔ', 'う'],
];

const FOLD_MAP = new Map();
for (const [from, to] of FOLD_PAIRS) {
  for (let i = 0; i < from.length; i += 1) FOLD_MAP.set(from[i], to[i]);
}

/**
 * カタカナ→ひらがな、濁点・小書き→清音、長音符と記号を落とす。
 * **並べ替えと行の判定にだけ使う**（画面に出す文字は元のまま）。
 */
export function foldKana(text) {
  if (typeof text !== 'string') return '';
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0);
    // カタカナ（ァ〜ヶ）はひらがなへ
    let c = code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : ch;
    c = FOLD_MAP.get(c) || c;
    if (c === 'ー' || c === '－' || c === '-' || c === '・' || c === '　' || c === ' ') continue;
    out += c;
  }
  return out;
}

const DIGIT_READINGS = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];

function under10000(n) {
  let out = '';
  const sen = Math.floor(n / 1000);
  const hyaku = Math.floor((n % 1000) / 100);
  const juu = Math.floor((n % 100) / 10);
  const ichi = n % 10;
  if (sen) {
    const head = sen === 1 ? '' : sen === 3 ? 'さん' : sen === 8 ? 'はっ' : DIGIT_READINGS[sen];
    out += head + (sen === 3 ? 'ぜん' : 'せん');
  }
  if (hyaku) {
    const head =
      hyaku === 1 ? '' : hyaku === 3 ? 'さん' : hyaku === 6 ? 'ろっ' : hyaku === 8 ? 'はっ' : DIGIT_READINGS[hyaku];
    const tail = hyaku === 3 ? 'びゃく' : hyaku === 6 || hyaku === 8 ? 'ぴゃく' : 'ひゃく';
    out += head + tail;
  }
  if (juu) out += (juu === 1 ? '' : DIGIT_READINGS[juu]) + 'じゅう';
  if (ichi) out += DIGIT_READINGS[ichi];
  return out;
}

/** 数値 → ひらがなの読み（0〜99999999）。「20」→ にじゅう、「361」→ さんびゃくろくじゅういち */
export function numberToReading(value) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'ぜろ';
  if (n < 0) return `まいなす${numberToReading(-n)}`;
  const man = Math.floor(n / 10000);
  const rest = n % 10000;
  if (man) return `${under10000(man)}まん${rest ? under10000(rest) : ''}`;
  return under10000(n);
}

const FULLWIDTH_ALNUM = /[Ａ-Ｚａ-ｚ０-９]/g;
const ROMAN = { Ⅰ: 'I', Ⅱ: 'II', Ⅲ: 'III', Ⅳ: 'IV', Ⅴ: 'V', Ⅵ: 'VI', Ⅶ: 'VII', Ⅷ: 'VIII', Ⅸ: 'IX', Ⅹ: 'X' };

/**
 * 英数字混じりの表記をそろえる。全角→半角・ローマ数字→英字・大文字化。
 * A〜Z の行を決める前に必ずこれを通す（「ＦＯＤＭＡＰ」と「FODMAP」を別の行にしないため）。
 */
export function normalizeAlnum(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(FULLWIDTH_ALNUM, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, (c) => ROMAN[c] || c)
    .toUpperCase();
}

/**
 * 並べ替え・行判定に使う読みのキー。
 * **読みの中の数字は必ず読みへ直す**（ルール2）。読みが無ければ空文字を返す
 * （＝「その他」へ落ちる。ここで漢字から推定しない）。
 */
export function readingKey(reading) {
  if (typeof reading !== 'string' || !reading.trim()) return '';
  const spelled = reading.replace(/\d+/g, (m) => numberToReading(m));
  return foldKana(spelled);
}

const ROW_OF_CHAR = new Map();
for (const row of KANA_ROWS) {
  for (const ch of row.chars) ROW_OF_CHAR.set(ch, row.id);
}

/**
 * 読みから行の id を返す（'a'|'ka'|…|'wa'|'alpha-A'…|'other'）。
 * かなでなければ、正規化した英字で A〜Z を見る（ルール4）。どちらでもなければ「その他」。
 */
export function kanaRow(reading) {
  const key = readingKey(reading);
  if (key) {
    const row = ROW_OF_CHAR.get(key[0]);
    if (row) return row;
  }
  const alnum = normalizeAlnum(typeof reading === 'string' ? reading.trim() : '');
  const head = alnum[0];
  if (head && head >= 'A' && head <= 'Z') return `alpha-${head}`;
  return OTHER_ROW.id;
}

const ORDER_OF_CHAR = new Map();
for (let i = 0; i < GOJUON.length; i += 1) ORDER_OF_CHAR.set(GOJUON[i], i);

/** 読みどうしの比較（五十音順）。かな以外は後ろへ */
export function compareReading(a, b) {
  const x = readingKey(a);
  const y = readingKey(b);
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i += 1) {
    const cx = x[i];
    const cy = y[i];
    if (cx === cy) continue;
    if (cx === undefined) return -1;
    if (cy === undefined) return 1;
    const ox = ORDER_OF_CHAR.has(cx) ? ORDER_OF_CHAR.get(cx) : 1000 + cx.charCodeAt(0);
    const oy = ORDER_OF_CHAR.has(cy) ? ORDER_OF_CHAR.get(cy) : 1000 + cy.charCodeAt(0);
    if (ox !== oy) return ox - oy;
  }
  return 0;
}

/** 見出しの並び。**「その他」はここに入れない**——`rows` に混ぜると、
 * 読みの入れ忘れが他の行と同じ顔で並んでしまい、入れ忘れとして見えなくなる
 * （返すのは `other` としてだけ。画面側が別の扱いで出す）。 */
const ALL_ROWS = [...KANA_ROWS, ...ALPHA_ROWS];
const ROW_INDEX = new Map(ALL_ROWS.map((row, i) => [row.id, i]));

/**
 * 目次の見出しごとに項目を割り振る。
 * 並びは「あ〜ん」→「A〜Z」→「その他」で、**中身が無い行は返さない**。
 *
 * @param {Array<{title:string, reading?:string}>} entries
 * @param {{ otherWarnThreshold?: number, onWarn?: (msg:string, items:Array)=>void }} options
 *   「その他」（＝読みの入れ忘れ）が閾値を超えたら `onWarn` を呼ぶ。
 *   **開発中に気づけるようにするためのもの**で、画面は止めない（ルール11）。
 */
export function buildKanaIndex(entries, options = {}) {
  const { otherWarnThreshold = 8, onWarn } = options;
  const list = Array.isArray(entries) ? entries : [];
  const buckets = new Map();
  for (const entry of list) {
    const rowId = kanaRow(entry && entry.reading);
    if (!buckets.has(rowId)) buckets.set(rowId, []);
    buckets.get(rowId).push(entry);
  }
  const rows = [];
  for (const row of ALL_ROWS) {
    const items = buckets.get(row.id);
    if (!items || !items.length) continue;
    items.sort((a, b) => compareReading(a.reading, b.reading) || String(a.title).localeCompare(String(b.title), 'ja'));
    rows.push({ id: row.id, label: row.label, items });
  }
  rows.sort((a, b) => ROW_INDEX.get(a.id) - ROW_INDEX.get(b.id));
  // 読みが無いものは並べ替えようがないので、入ってきた順のまま返す
  const other = buckets.get(OTHER_ROW.id) || [];
  if (other.length > otherWarnThreshold && typeof onWarn === 'function') {
    onWarn(
      `目次の「その他」が${other.length}件あります（読みの入れ忘れの可能性）。読みはデータに手で持たせてください。`,
      other,
    );
  }
  return { rows, other, total: list.length };
}
