// 目次・索引。**目次専用の手書きの一覧を作らない**——元データから毎回導く
// （書き写すと、片方だけ直したときに黙って食い違う。このリポジトリの他アプリと同じ線）。
//
// 元データ：`terms.js`（用語・画面）／`scales.js`（ブリストル）／`redFlags.js`（受診の目安）／
// `fodmap.js`（食材）。ユーザーが候補から追加したものは端末内の `userTerms` として重ねる。

import { TERMS, SCREENS } from './terms.js';
import { BRISTOL } from './scales.js';
import { RED_FLAGS, RED_FLAG_SOURCE } from './redFlags.js';
import { FODMAP_FOODS, FODMAP_LEVELS, FODMAP_SOURCE } from './fodmap.js';
import { readingKey, normalizeAlnum } from '../lib/yomi.js';

/** 飛び先の種類。**この4つだけ**（画面／記録の設問／機能／仕組み・決まり） */
export const DESTINATION_TYPES = ['page', 'question', 'function', 'system'];

export const DESTINATION_LABELS = {
  page: '画面',
  question: '記録',
  function: '機能',
  system: '仕組み',
};

/** 目次のまとまり */
export const TOC_GROUPS = [
  { id: 'term', label: '用語' },
  { id: 'scale', label: 'ものさし' },
  { id: 'flag', label: '受診の目安' },
  { id: 'food', label: '食材' },
  { id: 'screen', label: '画面' },
  { id: 'user', label: '自分で追加' },
];

export const PLACEHOLDER_DESCRIPTION = '※説明未登録';
export const EMPTY_DESTINATIONS_TEXT = '関連する飛び先はありません';
export const NEEDS_REVIEW_BADGE = '※要確認';

/** 食材の飛び先 id。**読みから作る**ので、一覧の並びを変えても id が動かない */
export function foodTargetId(food) {
  return `food-${food.reading}`;
}

const levelLabel = (id) => {
  const found = FODMAP_LEVELS.find((l) => l.id === id);
  return found ? found.label : id;
};

function fromBristol() {
  return BRISTOL.map((b) => ({
    id: `toc-bristol-${b.n}`,
    title: `ブリストル ${b.n}（${b.label}）`,
    reading: `ぶりすとる${b.n}`,
    group: 'scale',
    aliases: [{ name: b.label, reading: b.reading }],
    description: `${b.desc}。便のかたさを7段階で選ぶ物差しの${b.n}番目です。`,
    // 体のことは手元で確かめきれないので、必ず「※要確認」を出す
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'question', view: 'home', targetId: 'rec-stool', label: 'きょうのお通じを記録する' },
      { type: 'page', view: 'look', targetId: 'look-stool', label: 'ふりかえりで分布を見る' },
    ],
  }));
}

function fromRedFlags() {
  return RED_FLAGS.map((flag) => ({
    id: `toc-flag-${flag.id}`,
    title: flag.title,
    reading: flag.reading,
    group: 'flag',
    aliases: [],
    description: [flag.note, '受診の目安に載っている項目です。当てはまった数は数えません。']
      .filter(Boolean)
      .join(' '),
    descriptionStatus: RED_FLAG_SOURCE.check ? 'needs_review' : 'verified',
    destinations: [
      { type: 'page', view: 'redflags', targetId: `flag-${flag.id}`, label: '受診の目安で読む' },
      { type: 'question', view: 'home', targetId: 'rec-stool', label: '気になった印を記録する' },
    ],
  }));
}

function fromFoods() {
  return FODMAP_FOODS.map((food) => ({
    id: `toc-${foodTargetId(food)}`,
    title: food.name,
    reading: food.reading,
    group: 'food',
    aliases: [],
    // 説明は手で書いた分類と補足から組み立てる（機械が食材を判定しているのではない）
    description: [`低FODMAP の一覧では「${levelLabel(food.level)}」に入っています。`, food.note]
      .filter(Boolean)
      .join(' '),
    descriptionStatus: FODMAP_SOURCE.check ? 'needs_review' : 'verified',
    destinations: [
      { type: 'page', view: 'fodmap', targetId: foodTargetId(food), label: '一覧で見る' },
      { type: 'system', view: 'fodmap', targetId: 'fodmap-source', label: '出典と最終確認日を見る' },
    ],
  }));
}

function withGroup(list, group) {
  return list.map((entry) => ({ aliases: [], destinations: [], ...entry, group }));
}

/**
 * 目次の項目をすべて作る。
 *
 * @param {{ userTerms?: Array, removedIds?: string[] }} state
 *   `userTerms` は候補から「追加する」で入ったもの、`removedIds` は「削除する」で外したもの。
 *   **どちらも端末の中だけ**で、元データのファイルは書き換えない。
 */
export function buildTocEntries(state = {}) {
  const userTerms = Array.isArray(state.userTerms) ? state.userTerms : [];
  const removed = new Set(Array.isArray(state.removedIds) ? state.removedIds : []);
  const all = [
    ...withGroup(TERMS, 'term'),
    ...withGroup(SCREENS, 'screen'),
    ...fromBristol(),
    ...fromRedFlags(),
    ...fromFoods(),
    ...withGroup(userTerms, 'user'),
  ];
  const seen = new Set();
  const out = [];
  for (const entry of all) {
    if (removed.has(entry.id)) continue;
    // タイトルの重複は作らない（テストが機械チェックする）。あとから来たほうを落とす
    const key = entry.title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/** 検索用の当たり判定（タイトル・読み・別名・説明）。**当たった理由が分かる形で返す** */
export function entryMatches(entry, query) {
  const q = String(query || '').trim();
  if (!q) return { hit: true, via: null };
  const needleKana = readingKey(q) || '';
  const needleAlnum = normalizeAlnum(q);
  const raw = q.toLowerCase();
  if (entry.title.toLowerCase().includes(raw)) return { hit: true, via: null };
  if (normalizeAlnum(entry.title).includes(needleAlnum) && needleAlnum) return { hit: true, via: null };
  if (needleKana && readingKey(entry.reading).includes(needleKana)) return { hit: true, via: null };
  for (const alias of entry.aliases || []) {
    if (alias.name.toLowerCase().includes(raw)) return { hit: true, via: alias.name };
    if (needleKana && readingKey(alias.reading).includes(needleKana)) return { hit: true, via: alias.name };
  }
  if (entry.description && entry.description.includes(q)) return { hit: true, via: null };
  return { hit: false, via: null };
}

/** 別名 → 正式なタイトル。見つからなければ null（当てずっぽうで返さない） */
export function resolveAlias(entries, name) {
  const needle = String(name || '').trim();
  if (!needle) return null;
  const kana = readingKey(needle);
  for (const entry of entries) {
    if (entry.title === needle) return entry.title;
  }
  for (const entry of entries) {
    for (const alias of entry.aliases || []) {
      if (alias.name === needle) return entry.title;
      if (kana && readingKey(alias.reading) === kana) return entry.title;
    }
  }
  return null;
}

/**
 * 飛び先ごとに、**飛ぶ前に画面をどの状態へ切り替えておくか**を返す。
 * 絞り込みが掛かったままだと飛び先が画面に無いので掴めない
 * （切り替えは `useLayoutEffect` で、描き終わる前に済ませること）。
 */
export function tabForTarget(targetId) {
  const id = String(targetId || '');
  if (id.startsWith('food-') || id.startsWith('fodmap-')) return { level: 'all', query: '' };
  if (id === 'toc-candidates' || id === 'toc-history') return { tab: 'candidates' };
  return {};
}

/** 詳細パネルに出すもの。**画面はこの1か所から受け取る**（画面ごとに条件を書かない） */
export function panelDataFor(entry) {
  if (!entry) return null;
  const description = (entry.description || '').trim();
  const destinations = (entry.destinations || []).filter(
    (d) => d && DESTINATION_TYPES.includes(d.type) && d.view,
  );
  return {
    title: entry.title,
    reading: entry.reading || '',
    aliases: entry.aliases || [],
    description: description || PLACEHOLDER_DESCRIPTION,
    hasDescription: Boolean(description),
    needsReview: entry.descriptionStatus !== 'verified',
    destinations,
    hasDestinations: destinations.length > 0,
    emptyDestinationsText: EMPTY_DESTINATIONS_TEXT,
  };
}
