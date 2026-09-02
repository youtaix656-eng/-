// 目次・索引。**目次専用の手書きの一覧を作らない**——元データから毎回導く
// （書き写すと、片方だけ直したときに黙って食い違う。このリポジトリの他アプリと同じ線）。
//
// 元データ：`terms.js`（用語・画面）／`scales.js`（ブリストル）／`redFlags.js`（受診の目安）／
// `fodmap.js`（食材）／`adamski.js`（食べ合わせ）／`probiotics.js`・`seasonings.js`（整腸剤・調味料）／
// `cleanup.js`（腸のお掃除）／`prebiotics.js`（善玉菌の餌）。
// ユーザーが候補から追加したものは端末内の `userTerms` として重ねる。

import { TERMS, SCREENS } from './terms.js';
import { BRISTOL } from './scales.js';
import { RED_FLAGS, RED_FLAG_SOURCE } from './redFlags.js';
import { FODMAP_FOODS, FODMAP_LEVELS, FODMAP_SOURCE } from './fodmap.js';
import { SPEED_NAMED, SPEED_BY_ID, BAD_PAIRS, ADAMSKI_UNVERIFIED } from './adamski.js';
import { BACTERIA, PRODUCTS, PROBIOTIC_UNVERIFIED, PROBIOTIC_CORRECTIONS } from './probiotics.js';
import { SEASONINGS, SEASONING_AVOID } from './seasonings.js';
import {
  PREBIOTIC_FOODS,
  PREBIOTIC_KINDS,
  KIND_BY_ID,
  SOURCE_CONFLICTS,
  PREBIOTIC_CORRECTIONS,
  PREBIOTIC_UNVERIFIED,
  OMEGA3,
  APPLE_VINEGAR,
} from './prebiotics.js';
import {
  CLEANUP_STEPS,
  STRESS_RELIEF,
  POSTURE_TIPS,
  CLEANUP_CORRECTIONS,
  CLEANUP_UNVERIFIED,
} from './cleanup.js';
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
  { id: 'combine', label: '食べ合わせ' },
  { id: 'care', label: '整腸剤・調味料' },
  { id: 'cleanup', label: '腸のお掃除' },
  { id: 'prebiotic', label: '善玉菌の餌' },
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

/**
 * 食べ合わせ（アダムスキー式）から。
 *  - 低FODMAP の一覧に無い食べもの（出典だけが名指ししているもの）
 *  - よくない組み合わせとして挙げられている代表例
 *  - **裏が取れていない主張**（目次からも辿れるようにする。隠さないため）
 * どれも出典を確かめきれていないので、確からしさは必ず `needs_review`。
 */
function fromAdamski() {
  const inFodmap = new Set(FODMAP_FOODS.map((f) => f.name));
  const foods = SPEED_NAMED.filter((f) => !inFodmap.has(f.name)).map((f) => ({
    id: `toc-speed-${f.reading}`,
    title: f.name,
    reading: f.reading,
    group: 'combine',
    aliases: [],
    description: `アダムスキー式では「${SPEED_BY_ID[f.speed].label}」とされています。${SPEED_BY_ID[f.speed].note}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'combine', targetId: 'combine-speeds', label: '一覧で見る' },
      { type: 'function', view: 'combine', targetId: 'combine-check', label: '組み合わせを見る' },
    ],
  }));
  const pairs = BAD_PAIRS.map((pair) => ({
    id: `toc-badpair-${pair.id}`,
    title: pair.title,
    reading: pair.reading,
    group: 'combine',
    aliases: [],
    description: `速い：${pair.fast}／遅い：${pair.slow}。${pair.note}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'combine', targetId: `badpair-${pair.id}`, label: '読む' },
      { type: 'function', view: 'combine', targetId: 'combine-check', label: '組み合わせを見る' },
    ],
  }));
  const claims = ADAMSKI_UNVERIFIED.map((item) => ({
    id: `toc-unverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'combine',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'combine', targetId: `unverified-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  return [...foods, ...pairs, ...claims];
}

/**
 * 整腸剤と調味料から。
 * **調味料は「◯◯の選び方」という題にする**——「塩」「酢」は低FODMAP の一覧にもあり、
 * 同じ題にすると重複で落ちて、選び方の画面へ行けなくなる（実際にぶつかった）。
 */
function fromCare() {
  const bacteria = BACTERIA.map((b) => ({
    id: `toc-bacteria-${b.id}`,
    title: b.name,
    reading: b.reading,
    group: 'care',
    aliases: [],
    description: `出典では${b.where}に住み着きやすいとされています。${b.note}`,
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'probiotics', targetId: `bacteria-${b.id}`, label: '一覧で見る' }],
  }));
  const products = PRODUCTS.map((p) => ({
    id: `toc-product-${p.id}`,
    title: p.name,
    reading: p.reading,
    group: 'care',
    aliases: [],
    description: `出典が挙げている整腸剤のひとつ。${p.note} このアプリはどれかを勧めません。`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'probiotics', targetId: `product-${p.id}`, label: '並べて見る' },
      { type: 'function', view: 'probiotics', targetId: 'probiotic-mine', label: '飲んでいるものを登録する' },
    ],
  }));
  const claims = PROBIOTIC_UNVERIFIED.map((item) => ({
    id: `toc-punverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'care',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'probiotics', targetId: `punverified-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  const fixes = PROBIOTIC_CORRECTIONS.map((item) => ({
    id: `toc-correction-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'care',
    aliases: [],
    description: item.correction.replace(/\*\*/g, ''),
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'probiotics', targetId: `correction-${item.id}`, label: '読む' },
    ],
  }));
  const seasonings = SEASONINGS.map((item) => ({
    id: `toc-seasoning-${item.id}`,
    title: `${item.title}の選び方`,
    reading: `${item.reading}のえらびかた`,
    group: 'care',
    aliases: [{ name: item.title, reading: item.reading }],
    description: `選ぶなら：${item.choose}。見るところ：${item.look} ${item.note}`,
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'seasonings', targetId: `seasoning-${item.id}`, label: '見分け方を読む' }],
  }));
  const avoid = {
    id: 'toc-seasoning-avoid',
    title: SEASONING_AVOID.title,
    reading: SEASONING_AVOID.reading,
    group: 'care',
    aliases: [{ name: 'めんつゆ', reading: 'めんつゆ' }],
    description: `${SEASONING_AVOID.body} ${SEASONING_AVOID.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'seasonings', targetId: 'seasoning-avoid', label: '読む' }],
  };
  return [...bacteria, ...products, ...claims, ...fixes, ...seasonings, avoid];
}

/** 腸のお掃除（5つ）から。**訂正した所も目次に置く**（何を直したか辿れるように） */
function fromCleanup() {
  const steps = CLEANUP_STEPS.map((step) => ({
    id: `toc-cleanup-${step.id}`,
    title: step.title,
    reading: step.reading,
    group: 'cleanup',
    aliases: [],
    description: `${step.body}${step.caution ? ` 注意：${step.caution.replace(/\*\*/g, '')}` : ''}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'cleanup', targetId: `cleanup-${step.id}`, label: '読む' },
      { type: 'question', view: step.record.view, targetId: step.record.targetId, label: step.record.label },
    ],
  }));
  const relief = STRESS_RELIEF.map((item) => ({
    id: `toc-relief-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'cleanup',
    aliases: [],
    description: `ストレスを減らす方法として挙げられているもの。${item.body}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'cleanup', targetId: `relief-${item.id}`, label: '読む' },
      { type: 'question', view: 'home', targetId: 'rec-life', label: 'ストレスを記録する' },
    ],
  }));
  const posture = POSTURE_TIPS.map((item) => ({
    id: `toc-posture-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'cleanup',
    aliases: [],
    description: item.body,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'cleanup', targetId: `posture-${item.id}`, label: '読む' },
      { type: 'question', view: 'home', targetId: 'rec-body', label: '姿勢を記録する' },
    ],
  }));
  const fixes = CLEANUP_CORRECTIONS.map((item) => ({
    id: `toc-ccorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'cleanup',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [{ type: 'system', view: 'cleanup', targetId: `ccorrection-${item.id}`, label: '読む' }],
  }));
  const claims = CLEANUP_UNVERIFIED.map((item) => ({
    id: `toc-cunverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'cleanup',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'cleanup', targetId: `cunverified-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  return [...steps, ...relief, ...posture, ...fixes, ...claims];
}

/**
 * 善玉菌の餌（プレバイオティクス）から。
 * **食べものは「◯◯（善玉菌の餌）」という題にする**——バナナ・ごぼう・キウイなど6件は
 * 低FODMAP の一覧にも同じ名前で載っていて、同じ題にすると重複で落ちる
 * （調味料の「◯◯の選び方」と同じ直し方。素の名前は別名で引ける）。
 * **食い違いも目次に置く**——低FODMAP とぶつかることも、出典どうしが食い違うことも、
 * 目次から辿れないと「無かったこと」になってしまう。
 */
function fromPrebiotics() {
  const kinds = PREBIOTIC_KINDS.map((kind) => ({
    id: `toc-pkind-${kind.id}`,
    title: kind.label,
    reading: kind.reading,
    group: 'prebiotic',
    aliases: [],
    description: `${kind.note} 出典が「善玉菌の餌」として挙げている3つのうちのひとつです。`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'prebiotics', targetId: `kind-${kind.id}`, label: '読む' },
    ],
  }));
  const foods = PREBIOTIC_FOODS.map((food) => ({
    id: `toc-prebiotic-${food.reading}`,
    title: `${food.name}（善玉菌の餌）`,
    reading: `${food.reading}ぜんだまきんのえさ`,
    group: 'prebiotic',
    aliases: [{ name: food.name, reading: food.reading }],
    description: [
      `出典では${KIND_BY_ID[food.kind].label}として挙げられています。`,
      food.note,
      food.fodmapName
        ? `低FODMAP の一覧では「${food.fodmapName}」として出てきます（目的が反対を向いているので、両方を並べています）。`
        : null,
    ]
      .filter(Boolean)
      .join(' '),
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'prebiotics', targetId: `prebiotic-${food.reading}`, label: '一覧で見る' },
      { type: 'system', view: 'prebiotics', targetId: 'prebiotic-vs-fodmap', label: '低FODMAP との食い違いを読む' },
    ],
  }));
  const conflicts = SOURCE_CONFLICTS.map((item) => ({
    id: `toc-sconflict-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'prebiotic',
    aliases: [],
    description: `A：${item.a}／B：${item.b} このアプリはどちらが正しいかを決めません。`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'prebiotics', targetId: `sconflict-${item.id}`, label: '両方の言い分を読む' },
    ],
  }));
  const fixes = PREBIOTIC_CORRECTIONS.map((item) => ({
    id: `toc-pbcorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'prebiotic',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'prebiotics', targetId: `pcorrection-${item.id}`, label: '読む' },
    ],
  }));
  const claims = PREBIOTIC_UNVERIFIED.map((item) => ({
    id: `toc-pbunverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'prebiotic',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'prebiotics', targetId: `punv2-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  const omega3 = {
    id: 'toc-omega3',
    title: OMEGA3.title,
    reading: OMEGA3.reading,
    group: 'prebiotic',
    aliases: [{ name: 'オメガ3', reading: 'おめがすりー' }],
    description: `${OMEGA3.body} 注意：${OMEGA3.caution}`,
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'prebiotics', targetId: 'prebiotic-omega3', label: '読む' }],
  };
  const vinegar = {
    id: 'toc-apple-vinegar',
    title: APPLE_VINEGAR.title,
    reading: APPLE_VINEGAR.reading,
    group: 'prebiotic',
    aliases: [{ name: 'りんご酢', reading: 'りんごす' }],
    description: `${APPLE_VINEGAR.body} 注意：${APPLE_VINEGAR.caution}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'prebiotics', targetId: 'prebiotic-vinegar', label: '読む' },
      { type: 'system', view: 'prebiotics', targetId: 'sconflict-vinegar', label: '出典の食い違いを読む' },
    ],
  };
  return [...kinds, ...foods, ...conflicts, ...fixes, ...claims, omega3, vinegar];
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
    ...fromAdamski(),
    ...fromCare(),
    ...fromCleanup(),
    ...fromPrebiotics(),
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
