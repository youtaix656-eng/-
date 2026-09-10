// 読み（よみ）による並べ替え・50音インデックス。
//   - 数字は読み方に変換して五十音に混ぜる（例：361 → さんびゃく… → さ行）
//   - アルファベットは大文字小文字を区別せず A〜Z
//   - よく出る用語には読みを用意（TERM_READINGS）。未知の漢字は「漢字・その他」へ
//
// 索引（マインドマップ）で「読み込んだキーワード」をあ〜ん / A〜Z で並べるのに使う。

// 主要キーワードの読み（五十音で正しく並べるため）
export const TERM_READINGS = {
  // 経絡（略称）
  肺経: 'はいけい', 大腸経: 'だいちょうけい', 胃経: 'いけい', 脾経: 'ひけい',
  心経: 'しんけい', 小腸経: 'しょうちょうけい', 膀胱経: 'ぼうこうけい', 腎経: 'じんけい',
  心包経: 'しんぽうけい', 三焦経: 'さんしょうけい', 胆経: 'たんけい', 肝経: 'かんけい',
  // 臓腑
  肺: 'はい', 大腸: 'だいちょう', 胃: 'い', 脾: 'ひ', 心: 'しん', 小腸: 'しょうちょう',
  膀胱: 'ぼうこう', 腎: 'じん', 心包: 'しんぽう', 三焦: 'さんしょう', 胆: 'たん', 肝: 'かん',
  // 原穴など経穴
  太淵: 'たいえん', 合谷: 'ごうこく', 衝陽: 'しょうよう', 太白: 'たいはく', 神門: 'しんもん',
  腕骨: 'わんこつ', 京骨: 'けいこつ', 太谿: 'たいけい', 大陵: 'だいりょう', 陽池: 'ようち',
  丘墟: 'きゅうきょ', 太衝: 'たいしょう', 足三里: 'あしさんり', 委中: 'いちゅう', 列缺: 'れっけつ',
  // 要穴カテゴリ
  原穴: 'げんけつ', 絡穴: 'らくけつ', 郄穴: 'げきけつ', 四総穴: 'しそうけつ', 五兪穴: 'ごゆけつ',
  要穴: 'ようけつ', 募穴: 'ぼけつ', 背部兪穴: 'はいぶゆけつ', 八会穴: 'はちえけつ',
  八脈交会穴: 'はちみゃくこうえけつ', 井穴: 'せいけつ', 滎穴: 'えいけつ', 兪穴: 'ゆけつ', 合穴: 'ごうけつ',
  // 東洋医学
  五行: 'ごぎょう', 五臓: 'ごぞう', 六腑: 'ろっぷ', 相生: 'そうせい', 相剋: 'そうこく',
  経絡: 'けいらく', 経穴: 'けいけつ', 奇経: 'きけい', 正経十二経: 'せいけいじゅうにけい',
  陰陽: 'いんよう', 気血水: 'きけつすい', 虚実: 'きょじつ', 寒熱: 'かんねつ', 表裏: 'ひょうり',
  望診: 'ぼうしん', 聞診: 'ぶんしん', 問診: 'もんしん', 切診: 'せっしん', 脈診: 'みゃくしん', 舌診: 'ぜっしん',
  木: 'もく', 火: 'か', 土: 'ど', 金: 'きん', 水: 'すい',
  // 解剖・生理・病理・臨床
  交感神経: 'こうかんしんけい', 副交感神経: 'ふくこうかんしんけい', 自律神経: 'じりつしんけい',
  迷走神経: 'めいそうしんけい', 正中神経: 'せいちゅうしんけい', 橈骨神経: 'とうこつしんけい',
  尺骨神経: 'しゃっこつしんけい', 坐骨神経: 'ざこつしんけい', 三叉神経: 'さんさしんけい', 顔面神経: 'がんめんしんけい',
  頸椎: 'けいつい', 胸椎: 'きょうつい', 腰椎: 'ようつい', 肋骨: 'ろっこつ',
  脳神経: 'のうしんけい', 脊髄神経: 'せきずいしんけい', 脊柱: 'せきちゅう',
  炎症: 'えんしょう', 腫瘍: 'しゅよう', 免疫: 'めんえき', 感染: 'かんせん',
  腰痛: 'ようつう', 肩こり: 'かたこり', 頭痛: 'ずつう', 神経痛: 'しんけいつう',
};

const ONES = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const HYAKU = { 1: 'ひゃく', 3: 'さんびゃく', 6: 'ろっぴゃく', 8: 'はっぴゃく' };
const SEN = { 1: 'せん', 3: 'さんぜん', 8: 'はっせん' };

// 0〜9999 の読み（索引の並べ替え用。厳密でなくても先頭のかなが合えばよい）
export function numberToKana(num) {
  let n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'ぜろ';
  if (n > 9999) n = n % 10000;
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

// カタカナ→ひらがな
function kataToHira(s) {
  return String(s).replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
// 全角数字→半角
function zenNum(s) {
  return String(s).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

// 濁点・小書きを清音・大書きに寄せる（行の判定用）
const FOLD = {
  が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ', ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
  だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と', ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ',
  ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ', ぁ: 'あ', ぃ: 'い', ぅ: 'う', ぇ: 'え', ぉ: 'お',
  っ: 'つ', ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', ゎ: 'わ', ゐ: 'い', ゑ: 'え',
};
// 濁点・小書きを清音・大書きに寄せる（行判定用に外部公開。目次・索引パターンの単一の正）。
export function foldKana(ch) {
  return FOLD[ch] || ch;
}
const ROWS = [
  ['あ', 'あいうえお'], ['か', 'かきくけこ'], ['さ', 'さしすせそ'], ['た', 'たちつてと'],
  ['な', 'なにぬねの'], ['は', 'はひふへほ'], ['ま', 'まみむめも'], ['や', 'やゆよ'],
  ['ら', 'らりるれろ'], ['わ', 'わをん'],
];
// かな1文字 → 行ラベル（あ〜わ）。かな以外はnull。
export function kanaRow(ch) {
  const c = foldKana(ch);
  for (const [label, set] of ROWS) if (set.includes(c)) return label;
  return null;
}

// 全角英字→半角、ローマ数字（Ⅰ〜Ⅻ・ⅰ〜ⅻ）→ラテン文字列に正規化する。
//   目次・索引で「WHO」「Ⅰ型」のような英数字混じりの項目をA〜Z枠へ正しく振り分けるために使う
//   （見た目の全角・ローマ数字のままだと英字判定の正規表現に一致せず、誤って「その他」に落ちる）。
const ROMAN_UPPER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const ROMAN_LOWER = ROMAN_UPPER.map((r) => r.toLowerCase());
export function normalizeAlnum(s) {
  let out = String(s || '');
  out = zenNum(out); // 全角数字→半角
  out = out.replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)); // 全角英字→半角
  out = out.replace(/[Ⅰ-Ⅻ]/g, (c) => ROMAN_UPPER[c.charCodeAt(0) - 0x2160]); // Ⅰ〜Ⅻ
  out = out.replace(/[ⅰ-ⅻ]/g, (c) => ROMAN_LOWER[c.charCodeAt(0) - 0x2170]); // ⅰ〜ⅻ
  return out.trim();
}

// 用語 → { group, reading, key, type }
//   opts.strict: true の時は「読みが無い項目は必ずその他へ落とす」を厳密に適用する
//   （数字・英数字混じりだけは機械的に読めるので例外）。false（既定）では従来どおり、
//   readingsに登録が無くても先頭が仮名の項目はその仮名をそのまま読み扱いにする
//   （音声学習・一問一答などのキーワード一覧は個別readingを持たないため、この緩さが必要）。
export function readingInfo(term, readings = TERM_READINGS, opts = {}) {
  const { strict = false } = opts;
  const raw = String(term || '');
  if (readings[raw]) {
    const r = readings[raw];
    return { group: kanaRow(r[0]) || '漢字', reading: r, key: r, type: 'kana' };
  }
  const alnum = normalizeAlnum(raw);
  if (/^[A-Za-z]/.test(alnum)) {
    return { group: '英字', reading: alnum.toLowerCase(), key: alnum.toLowerCase(), type: 'latin' };
  }
  if (/^[0-9]/.test(alnum)) {
    const num = parseInt(alnum.match(/^[0-9]+/)[0], 10);
    const r = numberToKana(num);
    return { group: kanaRow(r[0]) || 'あ', reading: r, key: r, type: 'number' };
  }
  if (strict) {
    return { group: '漢字', reading: '', key: raw, type: 'other' };
  }
  const hira = kataToHira(raw);
  if (kanaRow(hira[0])) {
    return { group: kanaRow(hira[0]), reading: hira, key: hira, type: 'kana' };
  }
  return { group: '漢字', reading: raw, key: raw, type: 'other' };
}

// キーワード配列 → 索引（あ〜ん → 英字 → 漢字/その他）
//   opts.strict はreadingInfoへそのまま渡す。opts.warnOtherThresholdを指定すると、
//   「その他」（漢字グループ）の件数がしきい値を超えた時に開発モードでのみ警告する
//   （読みの入れ忘れが増えていないかに早く気づくためのガードレール。本番ビルドでは出さない）。
export function buildKanaIndex(keywords, readings = TERM_READINGS, opts = {}) {
  const { strict = false, warnOtherThreshold } = opts;
  const buckets = new Map();
  for (const kw of keywords) {
    const info = readingInfo(kw, readings, { strict });
    if (!buckets.has(info.group)) buckets.set(info.group, []);
    buckets.get(info.group).push({ keyword: kw, key: info.key });
  }
  if (warnOtherThreshold != null) {
    const otherCount = (buckets.get('漢字') || []).length;
    if (otherCount > warnOtherThreshold && typeof console !== 'undefined' && import.meta.env?.DEV) {
      console.warn(
        `[yomi] 「その他」行が${otherCount}件（しきい値${warnOtherThreshold}件）を超えています。readingの入れ忘れが無いか確認してください。`
      );
    }
  }
  const order = [...ROWS.map((r) => r[0]), '英字', '漢字'];
  const sections = [];
  for (const label of order) {
    const items = buckets.get(label);
    if (!items || items.length === 0) continue;
    items.sort((a, b) => a.key.localeCompare(b.key, 'ja'));
    sections.push({ label: label === '漢字' ? '漢字・その他' : label === '英字' ? 'A〜Z' : label, items: items.map((x) => x.keyword) });
  }
  return sections;
}

// 数字→読み（buildTocEntries等、目次系コードから呼ぶ時の名前をnumberToKanaと揃える別名）。
export function numberToReading(num) {
  return numberToKana(num);
}
