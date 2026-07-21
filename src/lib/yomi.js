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
const ROWS = [
  ['あ', 'あいうえお'], ['か', 'かきくけこ'], ['さ', 'さしすせそ'], ['た', 'たちつてと'],
  ['な', 'なにぬねの'], ['は', 'はひふへほ'], ['ま', 'まみむめも'], ['や', 'やゆよ'],
  ['ら', 'らりるれろ'], ['わ', 'わをん'],
];
function rowOf(ch) {
  const c = FOLD[ch] || ch;
  for (const [label, set] of ROWS) if (set.includes(c)) return label;
  return null;
}

// 用語 → { group, reading, key, type }
export function readingInfo(term, readings = TERM_READINGS) {
  const raw = String(term || '');
  if (readings[raw]) {
    const r = readings[raw];
    return { group: rowOf(r[0]) || '漢字', reading: r, key: r, type: 'kana' };
  }
  if (/^[A-Za-z]/.test(raw)) {
    return { group: '英字', reading: raw.toLowerCase(), key: raw.toLowerCase(), type: 'latin' };
  }
  const half = zenNum(raw);
  if (/^[0-9]/.test(half)) {
    const num = parseInt(half.match(/^[0-9]+/)[0], 10);
    const r = numberToKana(num);
    return { group: rowOf(r[0]) || 'あ', reading: r, key: r, type: 'number' };
  }
  const hira = kataToHira(raw);
  if (rowOf(hira[0])) {
    return { group: rowOf(hira[0]), reading: hira, key: hira, type: 'kana' };
  }
  return { group: '漢字', reading: raw, key: raw, type: 'other' };
}

// キーワード配列 → 索引（あ〜ん → 英字 → 漢字/その他）
export function buildKanaIndex(keywords, readings = TERM_READINGS) {
  const buckets = new Map();
  for (const kw of keywords) {
    const info = readingInfo(kw, readings);
    if (!buckets.has(info.group)) buckets.set(info.group, []);
    buckets.get(info.group).push({ keyword: kw, key: info.key });
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
