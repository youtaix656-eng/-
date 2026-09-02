// 読み仮名と索引（目次の並び）。
//
// リポジトリ共通の「目次・索引のルール」に従う：
//   1. 並びは「あ〜ん」→「A〜Z」。読み（ひらがな）で並べ替える。
//   2. 数字も読み方で振り分ける（「20歳未満」→ にじゅう…→ な行）。
//   3. **読みは明示、自動推定しない。** 漢字を含む項目は必ずデータ側に読みを持たせる。
//      ここで漢字の読みを推測してはいけない（誤読がそのまま索引に残るため）。
//   4. タイトルは重複させない（テストで機械チェックする）。

// 五十音の枠（この順に並べる）。最後に英字の枠、読み未設定の枠。
export const KANA_BUCKETS = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ'];
export const LATIN_BUCKET = 'A-Z';
export const UNKNOWN_BUCKET = 'その他';
export const BUCKETS = [...KANA_BUCKETS, LATIN_BUCKET, UNKNOWN_BUCKET];

// 行の判定。濁点・半濁点・小書きは元の音の行に寄せる（が→か行、ぱ→は行、ゃ→や行）。
const ROW_OF = {
  あ: 'あ', い: 'あ', う: 'あ', え: 'あ', お: 'あ',
  ぁ: 'あ', ぃ: 'あ', ぅ: 'あ', ぇ: 'あ', ぉ: 'あ', ゔ: 'あ',
  か: 'か', き: 'か', く: 'か', け: 'か', こ: 'か',
  が: 'か', ぎ: 'か', ぐ: 'か', げ: 'か', ご: 'か', ゕ: 'か', ゖ: 'か',
  さ: 'さ', し: 'さ', す: 'さ', せ: 'さ', そ: 'さ',
  ざ: 'さ', じ: 'さ', ず: 'さ', ぜ: 'さ', ぞ: 'さ',
  た: 'た', ち: 'た', つ: 'た', て: 'た', と: 'た',
  だ: 'た', ぢ: 'た', づ: 'た', で: 'た', ど: 'た', っ: 'た',
  な: 'な', に: 'な', ぬ: 'な', ね: 'な', の: 'な',
  は: 'は', ひ: 'は', ふ: 'は', へ: 'は', ほ: 'は',
  ば: 'は', び: 'は', ぶ: 'は', べ: 'は', ぼ: 'は',
  ぱ: 'は', ぴ: 'は', ぷ: 'は', ぺ: 'は', ぽ: 'は',
  ま: 'ま', み: 'ま', む: 'ま', め: 'ま', も: 'ま',
  や: 'や', ゆ: 'や', よ: 'や', ゃ: 'や', ゅ: 'や', ょ: 'や',
  ら: 'ら', り: 'ら', る: 'ら', れ: 'ら', ろ: 'ら',
  わ: 'わ', を: 'わ', ん: 'わ', ゎ: 'わ',
};

// 辞書順の並び（同じ行の中の順番）。
const KANA_ORDER =
  'あぁいぃうぅゔえぇおぉ' +
  'かがきぎくぐけげこご' +
  'さざしじすずせぜそぞ' +
  'ただちぢっつづてでとど' +
  'なにぬねの' +
  'はばぱひびぴふぶぷへべぺほぼぽ' +
  'まみむめも' +
  'やゃゆゅよょ' +
  'らりるれろ' +
  'わゎをん' +
  'ー';

/** カタカナをひらがなにする（機械的な変換であり、読みの推定ではない）。 */
export function kataToHira(text = '') {
  return String(text).replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  );
}

/**
 * 読みとして比べられる形に畳む（カタカナ→ひらがな、記号・空白・英数字を落とす）。
 * **これは読みの推定ではない**——与えられた読みを機械的に正規化するだけ。
 */
export function foldKana(text = '') {
  const hira = kataToHira(String(text));
  return hira.replace(/[^ぁ-んー]/g, '');
}

/** 読みとして扱える形に整える（`foldKana` の別名。呼び出し元が多いので残す）。 */
export function normalizeReading(reading = '') {
  return foldKana(reading);
}

const DIGIT = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const JUU = ['', 'じゅう', 'にじゅう', 'さんじゅう', 'よんじゅう', 'ごじゅう', 'ろくじゅう', 'ななじゅう', 'はちじゅう', 'きゅうじゅう'];
// 100・300・600・800 は音が変わる（ひゃく／さんびゃく／ろっぴゃく／はっぴゃく）
const HYAKU = ['', 'ひゃく', 'にひゃく', 'さんびゃく', 'よんひゃく', 'ごひゃく', 'ろっぴゃく', 'ななひゃく', 'はっぴゃく', 'きゅうひゃく'];
// 1000・3000・8000 も同様（せん／さんぜん／はっせん）
const SEN = ['', 'せん', 'にせん', 'さんぜん', 'よんせん', 'ごせん', 'ろくせん', 'ななせん', 'はっせん', 'きゅうせん'];

function under10000(n) {
  return (
    SEN[Math.floor(n / 1000) % 10] +
    HYAKU[Math.floor(n / 100) % 10] +
    JUU[Math.floor(n / 10) % 10] +
    DIGIT[n % 10]
  );
}

/**
 * 数字を読み方（ひらがな）にする。
 * 目次で「20歳未満」が数字順で先頭に固まらず、「にじゅう…」で な行に入るようにするため。
 */
export function numberToKana(value) {
  const n = Math.floor(Math.abs(Number(value)));
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'ぜろ';
  const oku = Math.floor(n / 1e8);
  const man = Math.floor((n % 1e8) / 1e4);
  const rest = n % 1e4;
  let out = '';
  if (oku) out += `${under10000(oku)}おく`;
  if (man) out += `${under10000(man)}まん`;
  if (rest) out += under10000(rest);
  return out;
}

// 全角の英数字・ローマ数字を、半角の英数字にそろえるための対応表。
// **ここでも読みは推定しない**——字の形をそろえるだけ。
const ROMAN = {
  '\u2160': 'I', '\u2161': 'II', '\u2162': 'III', '\u2163': 'IV', '\u2164': 'V',
  '\u2165': 'VI', '\u2166': 'VII', '\u2167': 'VIII', '\u2168': 'IX', '\u2169': 'X',
  '\u216A': 'XI', '\u216B': 'XII',
  '\u2170': 'I', '\u2171': 'II', '\u2172': 'III', '\u2173': 'IV', '\u2174': 'V',
  '\u2175': 'VI', '\u2176': 'VII', '\u2177': 'VIII', '\u2178': 'IX', '\u2179': 'X',
};

/**
 * 英数字混じりの項目（ＷＨＯ・Ⅰ型 など）を、A〜Z の枠を判定できる形にそろえる。
 * 全角→半角、ローマ数字→英字、記号・空白を落として大文字にする。
 * **かな・漢字はそのまま残す**（落とすと「Ⅰ型」が「I」になり、別の項目と衝突する）。
 */
export function normalizeAlnum(text = '') {
  return String(text)
    .replace(/[\u2160-\u2169\u2170-\u2179]/g, (c) => ROMAN[c] || c)
    // 全角の英数字を半角へ
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    // 記号・空白は落とす（英数字・かな・漢字・長音だけ残す）。
    // **かなの枠に混ざっている記号（・゠、濁点だけ、句読点）も落とす**——
    // 残すと「・」だけの題名が「字としてそろっている」ことになってしまう。
    .replace(/[\u3000-\u303f\u309b\u309c\u30a0\u30fb]/g, '')
    .replace(/[^0-9A-Za-z\u3040-\u30ff\u3400-\u9fff\uf900-\ufaffー]/g, '')
    .replace(/[a-z]+/g, (m) => m.toUpperCase());
}

/** この読みがどの枠（行）に入るか（`kanaRow` の実体）。 */
export function bucketOf(reading = '') {
  const r = normalizeReading(reading);
  for (const ch of r) {
    if (ch === 'ー') continue; // 長音では行が決まらないので次の字を見る
    const row = ROW_OF[ch];
    if (row) return row;
  }
  return UNKNOWN_BUCKET;
}

/** 読みの行（あ〜わ）。`bucketOf` の別名——共通ルールの呼び名にそろえたもの。 */
export function kanaRow(reading = '') {
  return bucketOf(reading);
}

/** 数字を読みに直す（`numberToKana` の別名。共通ルールの呼び名）。 */
export function numberToReading(value) {
  return numberToKana(value);
}

function charRank(ch) {
  const i = KANA_ORDER.indexOf(ch);
  return i >= 0 ? i : 1000 + ch.codePointAt(0);
}

/** 読みの辞書順で比べる。 */
export function compareReading(a = '', b = '') {
  const x = normalizeReading(a);
  const y = normalizeReading(b);
  // どちらもかなを持たない（A〜Z の枠など）時は、そのまま字の順で比べる。
  // ここを空文字どうしの比較にすると、英字の項目が全部「同じ」になって並ばない。
  if (!x && !y) {
    const ax = normalizeAlnum(a);
    const ay = normalizeAlnum(b);
    return ax < ay ? -1 : ax > ay ? 1 : 0;
  }
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i += 1) {
    if (i >= x.length) return -1;
    if (i >= y.length) return 1;
    const d = charRank(x[i]) - charRank(y[i]);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * タイトルと（あれば）明示された読みから、索引の情報を返す。
 *
 * **漢字の読みは推定しない。** 読みが無い漢字混じりの項目は
 * source:'missing' として「その他」の枠に入れ、データ側の入れ忘れが
 * 目次の上で見えるようにする（テストでも落とす）。
 */
export function readingInfo(title = '', reading = '') {
  const explicit = normalizeReading(reading);
  if (explicit) {
    return { reading: explicit, bucket: bucketOf(explicit), source: 'explicit' };
  }

  const text = String(title).trim();

  // 数字で始まるものは読み方に直して振り分ける（ルール2）
  const num = text.match(/^(\d+)/);
  if (num) {
    const r = numberToKana(num[1]);
    return { reading: r, bucket: bucketOf(r), source: 'number' };
  }

  // 英数字混じり（ＷＨＯ・Ⅰ型 など）は、そろえてから A〜Z の枠を判定する（共通ルール4）
  const alnum = normalizeAlnum(text);
  if (/^[A-Za-z]/.test(alnum)) {
    return { reading: alnum.toLowerCase(), bucket: LATIN_BUCKET, source: 'latin' };
  }

  // かな・カタカナだけなら機械変換で足りる（漢字が混じらないので誤読しない）
  if (/^[ぁ-んァ-ヶーー・\s]+$/.test(text)) {
    const r = normalizeReading(text);
    if (r) return { reading: r, bucket: bucketOf(r), source: 'kana' };
  }

  // 漢字を含むのに読みが無い＝データの入れ忘れ。推測せず「その他」に出す。
  return { reading: '', bucket: UNKNOWN_BUCKET, source: 'missing' };
}

/** 項目の配列を、枠ごとにまとめて読み順に並べる。 */
export function groupByBucket(items = []) {
  const map = new Map(BUCKETS.map((b) => [b, []]));
  for (const item of items) {
    const bucket = map.has(item.bucket) ? item.bucket : UNKNOWN_BUCKET;
    map.get(bucket).push(item);
  }
  return BUCKETS.map((bucket) => ({
    bucket,
    items: map.get(bucket).sort(
      (a, b) => compareReading(a.reading, b.reading) || String(a.title).localeCompare(String(b.title))
    ),
  })).filter((g) => g.items.length > 0);
}

/**
 * 索引を組み立てる。枠ごとの並び・件数・「その他」の件数をまとめて返す。
 *
 * **「その他」は読みの入れ忘れが見える場所**なので、件数を必ず一緒に返す
 * （画面と開発時の警告が同じ数を見るため。共通ルール3・11）。
 */
export function buildKanaIndex(items = []) {
  const rows = groupByBucket(items);
  const counts = {};
  for (const r of rows) counts[r.bucket] = r.items.length;
  return {
    rows,
    counts,
    total: items.length,
    otherCount: counts[UNKNOWN_BUCKET] || 0,
    // 読みが無くて落ちた項目（データの入れ忘れを名指しできるように）
    missing: items.filter((i) => i.bucket === UNKNOWN_BUCKET),
  };
}
