// ジャンル（分野）。役職と直交する軸。
//
//   役職（何ができるか） × ジャンル（どの分野で） × 席（3人）
//
// 同じ「リサーチャー」でも、医療の調査が得意な人と、副業・お金の調査が
// 得意な人は別の人として雇える。1つの組（役職×ジャンル）につき3席が既定。
//
// **reading は必ず明示する**（目次の共通ルール3。漢字の読みを推定しない）。

export const GENRES = [
  {
    id: 'general',
    name: '汎用',
    reading: 'はんよう',
    glyph: '◉',
    order: 1,
    desc: '分野を限定しない。まずはここから。',
  },
  {
    id: 'health',
    name: '医療・健康',
    reading: 'いりょうけんこう',
    glyph: '⚕',
    order: 2,
    desc: 'からだ・施術・健康の分野。断定を避け、受診の目安を必ず添える。',
    caution: '医療の内容は診断ではありません。判断は必ず有資格者・医療機関に確認してください。',
  },
  {
    id: 'study',
    name: '学習・試験',
    reading: 'がくしゅうしけん',
    glyph: '◎',
    order: 3,
    desc: '勉強の計画・暗記・過去問など。',
  },
  {
    id: 'money',
    name: '副業・お金',
    reading: 'ふくぎょうおかね',
    glyph: '¥',
    order: 4,
    desc: '収入をつくる分野。相場・単価・手取りを扱う。',
    caution: '税・法律にかかわる判断は、必ず専門家か公的な窓口で確認してください。',
  },
  {
    id: 'writing',
    name: '文章・発信',
    reading: 'ぶんしょうはっしん',
    glyph: '✎',
    order: 5,
    desc: '記事・SNS・台本など、書いて届ける分野。',
  },
  {
    id: 'design',
    name: 'デザイン',
    reading: 'でざいん',
    glyph: '◈',
    order: 6,
    desc: '見た目・構成・配色の分野。',
  },
  {
    id: 'tech',
    name: 'IT・開発',
    reading: 'あいてぃーかいはつ',
    glyph: '⌗',
    order: 7,
    desc: 'アプリ・ツール・自動化の分野。',
  },
  {
    id: 'business',
    name: '商売・集客',
    reading: 'しょうばいしゅうきゃく',
    glyph: '➤',
    order: 8,
    desc: 'お客様を集め、続けてもらう分野。',
  },
  {
    id: 'life',
    name: '暮らし',
    reading: 'くらし',
    glyph: '☾',
    order: 9,
    desc: '生活・家事・体調・睡眠など、日々のこと。',
  },
];

export const DEFAULT_GENRE_ID = 'general';

/** 1つの組（役職×ジャンル）に置く席数の既定。定数ではなく初期値。 */
export const DEFAULT_SEATS_PER_GENRE = 3;

/** 組み込み＋ユーザーが足したジャンルを合わせた一覧。 */
export function allGenres(custom = []) {
  const extra = (custom || []).filter((g) => g && g.id && !GENRES.some((b) => b.id === g.id));
  return [...GENRES, ...extra].sort((a, b) => (a.order || 99) - (b.order || 99));
}

export function genreById(id, custom = []) {
  return allGenres(custom).find((g) => g.id === id) || null;
}

/** ユーザーが足すジャンル。読みは必須（推定しないため）。 */
export function makeGenre({ name, reading, glyph = '◇', desc = '' }) {
  const clean = String(name || '').trim();
  const yomi = String(reading || '').trim();
  if (!clean) throw new Error('ジャンル名を入れてください');
  if (!yomi) throw new Error('読み（ひらがな）を入れてください。目次の並びに使います');
  if (!/^[ぁ-んー\s]+$/.test(yomi)) throw new Error('読みはひらがなで入れてください');
  return {
    id: `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: clean.slice(0, 20),
    reading: yomi.replace(/\s+/g, '').slice(0, 40),
    glyph: (glyph || '◇').slice(0, 2),
    desc: String(desc || '').slice(0, 80),
    order: 50,
    custom: true,
  };
}
