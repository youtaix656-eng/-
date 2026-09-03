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
import {
  SHORT_CHAIN,
  BUTYRATE_ROLES,
  WITHDRAWN,
  BUTYRATE_CORRECTIONS,
  BUTYRATE_UNVERIFIED,
} from './butyrate.js';
import { OTC_KINDS, OTC_CORRECTIONS, OTC_UNVERIFIED } from './otcDrugs.js';
import {
  HARMFUL_HABITS,
  HELPFUL_HABITS,
  WEAK_STOMACH_AVOID,
  HABIT_CORRECTIONS,
  HABIT_UNVERIFIED,
} from './gutHabits.js';
import {
  PROTEIN_FOODS,
  PROTEIN_GUIDES,
  ELIMINATION_TARGETS,
  VITAMIN_D,
  PROTEIN_CORRECTIONS,
  PROTEIN_UNVERIFIED,
} from './protein.js';
import {
  FASTING_SHAPES,
  FASTING_CLAIMS,
  FASTING_CORRECTIONS,
  FASTING_UNVERIFIED,
  FASTING_ALLOWED,
  FASTING_ALLOWED_NOTE,
} from './fasting.js';
import { MAGNESIUM_CORRECTIONS, MAGNESIUM_UNVERIFIED } from './magnesium.js';
import {
  MORNING_TRAITS,
  MORNING_HABITS,
  MORNING_CORRECTIONS,
  MORNING_UNVERIFIED,
} from './morning.js';
import {
  NAMED_FOODS,
  SUPER_FOOD,
  SCARED_CORRECTIONS,
  SCARED_UNVERIFIED,
} from './scaredFoods.js';
import {
  IBS_TYPES,
  IBS_EXCLUSION,
  IBS_PITFALLS,
  IBS_APPROACHES,
  SIBO_POINTS,
  SELF_CARE,
  IBS_CORRECTIONS,
  IBS_UNVERIFIED,
} from './ibs.js';
import {
  ALCOHOL_GUT,
  ALCOHOL_GUIDE,
  ALCOHOL_CORRECTIONS,
  ALCOHOL_UNVERIFIED,
} from './alcohol.js';
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
  { id: 'ibs', label: '過敏性腸症候群' },
  { id: 'food', label: '食材' },
  { id: 'combine', label: '食べ合わせ' },
  { id: 'care', label: '整腸剤・調味料' },
  { id: 'cleanup', label: '腸のお掃除' },
  { id: 'prebiotic', label: '善玉菌の餌' },
  { id: 'butyrate', label: '酪酸菌' },
  { id: 'otc', label: '市販薬' },
  { id: 'habit', label: '胃腸の習慣' },
  { id: 'protein', label: 'タンパク質' },
  { id: 'fasting', label: '断食・空腹' },
  { id: 'morning', label: '朝のリズム' },
  { id: 'scared', label: '名指しされた食べもの' },
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

/**
 * 酪酸菌・短鎖脂肪酸から。
 * **「出典自身が取り下げた説」も目次に置く**——本や記事にはまだ残っているので、
 * 検索して辿り着いたときに「もう言われていない」と分かる場所が要る。
 */
function fromButyrate() {
  // 「短鎖脂肪酸」という総称でも引けるようにする（別名は用語ではなくここに持つ——
  // 用語の側にも「酪酸」を置くと題がぶつかり、あとから来た派生側が黙って落ちる）
  const scfa = SHORT_CHAIN.map((item) => ({
    id: `toc-scfa-${item.id}`,
    title: item.name,
    reading: item.reading,
    group: 'butyrate',
    aliases: [{ name: '短鎖脂肪酸', reading: 'たんさしぼうさん' }],
    description: `${item.note} 出典が名前を挙げている短鎖脂肪酸のひとつです。`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'butyrate', targetId: `scfa-${item.id}`, label: '読む' },
      { type: 'page', view: 'butyrate', targetId: 'butyrate-roles', label: 'はたらきを読む' },
    ],
  }));
  const roles = BUTYRATE_ROLES.map((role) => ({
    id: `toc-brole-${role.id}`,
    title: role.title,
    reading: role.reading,
    group: 'butyrate',
    aliases: [],
    description: [role.body, role.note].filter(Boolean).join(' '),
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'butyrate', targetId: `brole-${role.id}`, label: '読む' }],
  }));
  const withdrawn = WITHDRAWN.map((item) => ({
    id: `toc-withdrawn-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'butyrate',
    aliases: [],
    description: `広まった説：${item.claim}。${item.withdrawn} ${item.note}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'butyrate', targetId: `withdrawn-${item.id}`, label: '取り下げの経緯を読む' },
    ],
  }));
  const fixes = BUTYRATE_CORRECTIONS.map((item) => ({
    id: `toc-bcorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'butyrate',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'butyrate', targetId: `bcorrection-${item.id}`, label: '読む' },
    ],
  }));
  const claims = BUTYRATE_UNVERIFIED.map((item) => ({
    id: `toc-bunverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'butyrate',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'butyrate', targetId: `bunv-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  // 芽胞は用語（`term-spore`）が単一の正なのでここでは作らない（題がぶつかる）
  return [...scfa, ...roles, ...withdrawn, ...fixes, ...claims];
}

/**
 * 市販薬から。
 * **薬の項目には必ず「記録する」か「受診の目安」への飛び先を付ける**
 * ——読んで終わりにせず、次にできることへ出すため。
 */
function fromOtc() {
  const kinds = OTC_KINDS.map((kind) => ({
    id: `toc-otc-${kind.id}`,
    title: `${kind.name}（市販薬）`,
    reading: `${kind.reading}しはんやく`,
    group: 'otc',
    aliases: [{ name: kind.name, reading: kind.reading }],
    description: `出典の説明：${kind.said.replace(/\*\*/g, '')} ${kind.doctor.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'otc', targetId: `otc-${kind.id}`, label: '読む' },
      { type: 'question', view: 'home', targetId: 'rec-otc', label: '使った日を記録する' },
    ],
  }));
  const fixes = OTC_CORRECTIONS.map((item) => ({
    id: `toc-ocorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'otc',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'otc', targetId: `ocorrection-${item.id}`, label: '読む' },
    ],
  }));
  const claims = OTC_UNVERIFIED.map((item) => ({
    id: `toc-ounverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'otc',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'otc', targetId: `ounv-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  // マグネシウムは市販薬の画面の中の節なので、このまとまりへ足す。
  // **食べもの（きのこ・海藻・きな粉・アーモンド）は項目にしない**——
  // アーモンドは低FODMAP の一覧と題がぶつかり、ほかも食材の一覧から辿れるため。
  const mgFixes = MAGNESIUM_CORRECTIONS.map((item) => ({
    id: `toc-mgcorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'otc',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'otc', targetId: `mgcorrection-${item.id}`, label: '読む' },
    ],
  }));
  const mgClaims = MAGNESIUM_UNVERIFIED.map((item) => ({
    id: `toc-mgunverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'otc',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'otc', targetId: `mgunv-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  return [...kinds, ...fixes, ...claims, ...mgFixes, ...mgClaims];
}

/** 胃腸の習慣から。**習慣には記録できる所への飛び先を必ず持たせる** */
function fromHabits() {
  const harmful = HARMFUL_HABITS.map((item) => ({
    id: `toc-harm-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'habit',
    aliases: [],
    description: `${item.body} ${item.said.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'habits', targetId: `harm-${item.id}`, label: '読む' },
      { type: 'question', view: item.record.view, targetId: item.record.targetId, label: item.record.label },
    ],
  }));
  const helpful = HELPFUL_HABITS.map((item) => ({
    id: `toc-help-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'habit',
    aliases: [],
    description: `${item.body} ${item.said.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'habits', targetId: `help-${item.id}`, label: '読む' },
      { type: 'question', view: item.record.view, targetId: item.record.targetId, label: item.record.label },
    ],
  }));
  const weak = {
    id: 'toc-weak-stomach',
    title: WEAK_STOMACH_AVOID.title,
    reading: WEAK_STOMACH_AVOID.reading,
    group: 'habit',
    aliases: [],
    description: `${WEAK_STOMACH_AVOID.items.join('・')}。${WEAK_STOMACH_AVOID.body} ${WEAK_STOMACH_AVOID.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'habits', targetId: 'habit-weak-stomach', label: '読む' },
      { type: 'system', view: 'habits', targetId: 'habit-fiber', label: '食物繊維の食い違いを読む' },
    ],
  };
  const fixes = HABIT_CORRECTIONS.map((item) => ({
    id: `toc-hcorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'habit',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'habits', targetId: `hcorrection-${item.id}`, label: '読む' },
    ],
  }));
  const claims = HABIT_UNVERIFIED.map((item) => ({
    id: `toc-hunverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'habit',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'habits', targetId: `hunv-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  // お酒は胃腸の習慣の画面の中の節なので、このまとまりへ足す
  const alcohol = ALCOHOL_GUT.map((item) => ({
    id: `toc-alc-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'habit',
    aliases: [],
    description: item.body,
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'habits', targetId: `alc-${item.id}`, label: '読む' }],
  }));
  const guide = {
    id: 'toc-alcohol-guide',
    title: ALCOHOL_GUIDE.title,
    reading: ALCOHOL_GUIDE.reading,
    group: 'habit',
    aliases: [{ name: '適量', reading: 'てきりょう' }],
    description: `${ALCOHOL_GUIDE.said} ${ALCOHOL_GUIDE.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'habits', targetId: 'alcohol-guide', label: '読む' }],
  };
  const alcFixes = ALCOHOL_CORRECTIONS.map((item) => ({
    id: `toc-acorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'habit',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'habits', targetId: `acorrection-${item.id}`, label: '読む' },
    ],
  }));
  const alcClaims = ALCOHOL_UNVERIFIED.map((item) => ({
    id: `toc-aunverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'habit',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'habits', targetId: `aunv-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  return [...harmful, ...helpful, weak, ...fixes, ...claims, ...alcohol, guide, ...alcFixes, ...alcClaims];
}

/**
 * タンパク質と腸から。
 * **食べものは「◯◯（タンパク質）」という題にする**——卵・納豆・肉・魚・木綿豆腐は
 * 低FODMAP や食べ合わせの一覧にも同じ名前で載っていて、同じ題にすると重複で落ちる
 * （「◯◯（善玉菌の餌）」と同じ直し方。素の名前は別名で引ける）。
 */
function fromProtein() {
  const foods = PROTEIN_FOODS.map((food) => ({
    id: `toc-protein-${food.id}`,
    title: `${food.name}（タンパク質）`,
    reading: `${food.reading}たんぱくしつ`,
    group: 'protein',
    aliases: [{ name: food.name, reading: food.reading }],
    description: `出典の目安：${food.amount}。${food.note}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'protein', targetId: `protein-${food.id}`, label: '一覧で見る' },
    ],
  }));
  const guides = PROTEIN_GUIDES.map((guide) => ({
    id: `toc-pguide-${guide.id}`,
    title: guide.title,
    reading: guide.reading,
    group: 'protein',
    aliases: [],
    description: `${guide.said} ${guide.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'protein', targetId: `guide-${guide.id}`, label: '読む' }],
  }));
  const targets = ELIMINATION_TARGETS.map((target) => ({
    id: `toc-elim-${target.id}`,
    title: `${target.name}をやめてみる`,
    reading: `${target.reading}をやめてみる`,
    group: 'protein',
    aliases: [{ name: target.name, reading: target.reading }],
    description: `${target.said} ${target.caution.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'function', view: 'protein', targetId: `elim-${target.id}`, label: 'ためしてみる' },
    ],
  }));
  const vitamind = {
    id: 'toc-vitamind',
    title: VITAMIN_D.title,
    reading: VITAMIN_D.reading,
    group: 'protein',
    aliases: [],
    description: `${VITAMIN_D.body} 注意：${VITAMIN_D.caution.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'protein', targetId: 'protein-vitamind', label: '読む' }],
  };
  const fixes = PROTEIN_CORRECTIONS.map((item) => ({
    id: `toc-prcorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'protein',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'protein', targetId: `prcorrection-${item.id}`, label: '読む' },
    ],
  }));
  const claims = PROTEIN_UNVERIFIED.map((item) => ({
    id: `toc-prunverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'protein',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'protein', targetId: `prunv-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  return [...foods, ...guides, ...targets, vitamind, ...fixes, ...claims];
}

/**
 * 断食・空腹の時間から。
 * **やめどきは目次に置かない**——文の一覧であって項目ではないため
 * （画面の `fasting-stop` へは「断食・空腹の画面」から辿れる）。
 */
function fromFasting() {
  const shapes = FASTING_SHAPES.map((shape) => ({
    id: `toc-fshape-${shape.id}`,
    title: shape.title,
    reading: shape.reading,
    group: 'fasting',
    aliases: [],
    description: `${shape.said} ${shape.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'fasting', targetId: `shape-${shape.id}`, label: '読む' },
      { type: 'system', view: 'fasting', targetId: 'fasting-stop', label: 'やめどきを先に読む' },
    ],
  }));
  const claims = FASTING_CLAIMS.map((item) => ({
    id: `toc-fclaim-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'fasting',
    aliases: [],
    description: [item.body, item.note].filter(Boolean).join(' '),
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'fasting', targetId: `fclaim-${item.id}`, label: '読む' }],
  }));
  const fixes = FASTING_CORRECTIONS.map((item) => ({
    id: `toc-fcorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'fasting',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'fasting', targetId: `fcorrection-${item.id}`, label: '読む' },
    ],
  }));
  const unverified = FASTING_UNVERIFIED.map((item) => ({
    id: `toc-funverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'fasting',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'fasting', targetId: `funv-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  // 空腹の時間中に食べてよいとされるものは**1件にまとめる**——
  // チーズ・ヨーグルトは低FODMAP の一覧と題がぶつかり、そこからも辿れるため。
  const allowed = {
    id: 'toc-fasting-allowed',
    title: '空腹の時間中でも食べてよいとされるもの',
    reading: 'くうふくのじかんちゅうでもたべてよいとされるもの',
    group: 'fasting',
    aliases: [],
    description: `${FASTING_ALLOWED.map((a) => a.name).join('・')}。${FASTING_ALLOWED_NOTE.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'fasting', targetId: 'fasting-allowed', label: '読む' },
      { type: 'function', view: 'protein', targetId: 'protein-elimination', label: '乳製品をやめてみる側を見る' },
    ],
  };
  return [...shapes, ...claims, ...fixes, ...unverified, allowed];
}

/**
 * 朝のリズムから。
 * **「出なくても責めない」は、このアプリの芯と同じ向き**なので目次からも辿れるようにする。
 */
function fromMorning() {
  const traits = MORNING_TRAITS.map((item) => ({
    id: `toc-trait-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'morning',
    aliases: [],
    description: item.body,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'morning', targetId: `trait-${item.id}`, label: '読む' },
      { type: 'page', view: item.link.view, targetId: item.link.targetId, label: item.link.label },
    ],
  }));
  const habits = MORNING_HABITS.map((item) => ({
    id: `toc-mhabit-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'morning',
    aliases: [],
    description: `${item.body} ${item.caution.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'morning', targetId: `mhabit-${item.id}`, label: '読む' },
      { type: 'question', view: 'home', targetId: 'rec-stool', label: 'お通じを記録する' },
    ],
  }));
  const fixes = MORNING_CORRECTIONS.map((item) => ({
    id: `toc-mcorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'morning',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'morning', targetId: `mcorrection-${item.id}`, label: '読む' },
    ],
  }));
  const claims = MORNING_UNVERIFIED.map((item) => ({
    id: `toc-munverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'morning',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'morning', targetId: `munv-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  return [...traits, ...habits, ...fixes, ...claims];
}

/**
 * 名指しされた食べものから。
 * **食べものの題に「食べるな」の意味を込めない**——名前だけを置き、
 * 説明のほうで「そう名指しされている」と書く。
 */
function fromIbs() {
  const types = IBS_TYPES.map((item) => ({
    id: `toc-itype-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'ibs',
    aliases: [],
    description: `${item.body} 出典：${item.said}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'ibs', targetId: `itype-${item.id}`, label: '読む' },
      { type: 'question', view: item.record.view, targetId: item.record.targetId, label: item.record.label },
    ],
  }));
  const exclusion = [
    {
      id: 'toc-ibs-exclusion',
      title: IBS_EXCLUSION.title,
      reading: IBS_EXCLUSION.reading,
      group: 'ibs',
      aliases: [],
      description: `${IBS_EXCLUSION.body} ${IBS_EXCLUSION.note.replace(/\*\*/g, '')}`,
      descriptionStatus: 'verified',
      destinations: [
        { type: 'page', view: 'ibs', targetId: 'ibs-exclusion', label: '読む' },
        { type: 'function', view: 'visitnote', targetId: 'note-out', label: '受診メモをつくる' },
      ],
    },
  ];
  const pitfalls = IBS_PITFALLS.map((item) => ({
    id: `toc-ipit-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'ibs',
    aliases: [],
    description: item.body,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'ibs', targetId: `ipit-${item.id}`, label: '読む' },
      { type: 'question', view: item.link.view, targetId: item.link.targetId, label: item.link.label },
    ],
  }));
  const approaches = IBS_APPROACHES.map((item) => ({
    id: `toc-iapp-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'ibs',
    aliases: [],
    description: `${item.body} ${item.caution.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'ibs', targetId: `iapp-${item.id}`, label: '読む' },
      ...(item.link
        ? [{ type: 'page', view: item.link.view, targetId: item.link.targetId, label: item.link.label }]
        : []),
    ],
  }));
  const sibo = SIBO_POINTS.map((item) => ({
    id: `toc-sibo-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'ibs',
    aliases: [],
    description: item.body,
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'ibs', targetId: `sibo-${item.id}`, label: '読む' }],
  }));
  const self = SELF_CARE.map((item) => ({
    id: `toc-iself-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'ibs',
    aliases: [],
    description: `出典：${item.said}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'ibs', targetId: `iself-${item.id}`, label: '読む' }],
  }));
  const fixes = IBS_CORRECTIONS.map((item) => ({
    id: `toc-icorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'ibs',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'ibs', targetId: `icorrection-${item.id}`, label: '読む' },
    ],
  }));
  const claims = IBS_UNVERIFIED.map((item) => ({
    id: `toc-iunverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'ibs',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'ibs', targetId: `iunv-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  return [...exclusion, ...types, ...pitfalls, ...approaches, ...sibo, ...self, ...fixes, ...claims];
}

/**
 * 名指しされた食べものから。
 * **食べものの題に「食べるな」の意味を込めない**——名前だけを置き、
 * 説明のほうで「そう名指しされている」と書く。
 */
function fromScared() {
  const foods = NAMED_FOODS.map((food) => ({
    id: `toc-named-${food.id}`,
    title: food.name,
    reading: food.reading,
    group: 'scared',
    aliases: [],
    description: `出典の言い分：${food.said} 選ぶときに見るところ：${food.look} ${food.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'page', view: 'scared', targetId: `named-${food.id}`, label: '読む' },
      { type: 'system', view: 'scared', targetId: 'scorrection-poison_food', label: '「猛毒」と呼ばない理由を読む' },
    ],
  }));
  const superFood = {
    id: 'toc-superfood',
    title: SUPER_FOOD.name,
    reading: SUPER_FOOD.reading,
    group: 'scared',
    aliases: [],
    description: `出典の言い分：${SUPER_FOOD.said} ${SUPER_FOOD.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [{ type: 'page', view: 'scared', targetId: 'super-food', label: '読む' }],
  };
  const fixes = SCARED_CORRECTIONS.map((item) => ({
    id: `toc-scorrection-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'scared',
    aliases: [],
    description: `出典：${item.claim}。${item.correction.replace(/\*\*/g, '')}`,
    descriptionStatus: 'verified',
    destinations: [
      { type: 'system', view: 'scared', targetId: `scorrection-${item.id}`, label: '読む' },
    ],
  }));
  const claims = SCARED_UNVERIFIED.map((item) => ({
    id: `toc-sunverified-${item.id}`,
    title: item.title,
    reading: item.reading,
    group: 'scared',
    aliases: [],
    description: `出典の主張：${item.claim}。${item.note.replace(/\*\*/g, '')}`,
    descriptionStatus: 'needs_review',
    destinations: [
      { type: 'system', view: 'scared', targetId: `sunv-${item.id}`, label: '裏が取れていない主張として読む' },
    ],
  }));
  return [...foods, superFood, ...fixes, ...claims];
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
    ...fromButyrate(),
    ...fromOtc(),
    ...fromHabits(),
    ...fromProtein(),
    ...fromFasting(),
    ...fromMorning(),
    ...fromScared(),
    ...fromIbs(),
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
