// 横断のまとめ（ユーザー指定・2026-09-03。「蓄積してまとめる」置き場）。
//
// このアプリの素材は動画の文字起こしで、1本ごとに1つのデータファイルへ入れてきた。
// そのため**同じ種類のもの（訂正・裏が取れていない主張・食い違い・出典）が
// 14ファイルに散っていて、横に並べて見る場所が無かった**。ここはそれを集める所。
//
// 決めていること
//  - **新しい主張を1件も書かない。** ここは元データから毎回導くだけの層で、
//    中身（言い分・訂正・注記）は各データファイルが単一の正のまま。
//    まとめ専用の手書きの一覧を作らない（README 決まり11・66・67・69と同じ線）。
//  - **数えるだけで、採点も順位付けもしない**（決まり1・2）。
//    「訂正が多いファイル＝悪い出典」とは書かない。
//  - **横断のまとまり（検査・ストレス・水分・体重）の中身は、
//    どの項目を集めるかを手で書く**——語の当てずっぽうな一致で
//    「これも関係ありそう」と拾うと、関係ないものを関係あるように見せてしまう
//    （決まり29の `fodmapName` と同じ線）。
//  - **空箱を作らない。** まとまりは、いま実際に集まっている項目だけを出す。

import { ADAMSKI_UNVERIFIED, ADAMSKI_SOURCE } from '../data/adamski.js';
import { ALCOHOL_CORRECTIONS, ALCOHOL_UNVERIFIED, ALCOHOL_SOURCE } from '../data/alcohol.js';
import {
  BUTYRATE_CORRECTIONS,
  BUTYRATE_UNVERIFIED,
  BUTYRATE_RUMORS,
  WITHDRAWN,
  BUTYRATE_SOURCE,
} from '../data/butyrate.js';
import {
  CLEANUP_CORRECTIONS,
  CLEANUP_UNVERIFIED,
  CLEANUP_SOURCE,
  CLEANUP_STEPS,
  STRESS_RELIEF,
} from '../data/cleanup.js';
import { FASTING_CORRECTIONS, FASTING_UNVERIFIED, FASTING_SOURCE, FASTING_SHAPES } from '../data/fasting.js';
import { FODMAP_SOURCE } from '../data/fodmap.js';
import { HABIT_CORRECTIONS, HABIT_UNVERIFIED, HABIT_SOURCE } from '../data/gutHabits.js';
import {
  IBS_CORRECTIONS,
  IBS_UNVERIFIED,
  IBS_SOURCE,
  IBS_OUT_OF_SCOPE,
  IBS_EXCLUSION,
  IBS_APPROACHES,
} from '../data/ibs.js';
import {
  MAGNESIUM_CORRECTIONS,
  MAGNESIUM_UNVERIFIED,
  MAGNESIUM_SOURCE,
  MAGNESIUM_SCOPE_NOTE,
} from '../data/magnesium.js';
import { MORNING_CORRECTIONS, MORNING_UNVERIFIED, MORNING_SOURCE, MORNING_HABITS } from '../data/morning.js';
import { OTC_CORRECTIONS, OTC_UNVERIFIED, OTC_SOURCE, OTC_KINDS } from '../data/otcDrugs.js';
import { PREBIOTIC_CORRECTIONS, PREBIOTIC_UNVERIFIED, PREBIOTIC_SOURCE } from '../data/prebiotics.js';
import {
  PROBIOTIC_CORRECTIONS,
  PROBIOTIC_UNVERIFIED,
  PROBIOTIC_SOURCE,
  SUPPLEMENT_SCOPE_NOTE,
} from '../data/probiotics.js';
import { PROTEIN_CORRECTIONS, PROTEIN_UNVERIFIED, PROTEIN_SOURCE } from '../data/protein.js';
import { RED_FLAGS, RED_FLAG_SOURCE } from '../data/redFlags.js';
import { SCARED_CORRECTIONS, SCARED_UNVERIFIED, SCARED_SOURCE } from '../data/scaredFoods.js';
import { SEASONING_SOURCE } from '../data/seasonings.js';
import { DISEASES, DISEASE_SOURCE } from '../data/diseases.js';
import { BREATH_STEPS, MASSAGE_STEPS, BREATHING_SOURCE } from '../data/breathing.js';
import { CARE_BY_TYPE, CARE_SOURCE } from '../data/ibsCare.js';
import { EATING_OUT_KINDS, EATING_OUT_SOURCE } from '../data/eatingOut.js';
import { FLORA_BASICS, FLORA_CORRECTIONS, FLORA_UNVERIFIED, FLORA_SOURCE } from '../data/flora.js';
import {
  conflictFoods,
  CONFLICT_NOTE,
  fermentViews,
  FERMENT_NOTE,
  prebioticConflicts,
  PREBIOTIC_VS_FODMAP_NOTE,
  fiberViews,
  FIBER_NOTE,
  withinSourceFiberConflict,
  proteinViews,
  PROTEIN_NOTE,
  breakfastViews,
  BREAKFAST_NOTE,
  dairyViews,
  DAIRY_NOTE,
  tsukemonoViews,
  TSUKEMONO_NOTE,
  fastingAllowedViews,
  FASTING_ALLOWED_CLASH_NOTE,
  ibsFermentViews,
  IBS_FERMENT_NOTE,
  mealGapViews,
  MEAL_GAP_CONFLICT_NOTE,
} from './conflicts.js';

/** 画面に出す文から強調の印を落とす（決まり49・75。目次へ流す所と同じ） */
export const plain = (s) => String(s || '').replace(/\*\*/g, '');

// ───────────────────── 素材ごとのまとまり ─────────────────────

/**
 * 素材（データファイル）1つぶんの登録。**ここが横断のまとめの単一の正**。
 * 新しい素材のデータファイルを足したら、**この配列にも1件足す**
 * （足さないと、訂正も裏が取れていない主張も出典も、まとめから静かに漏れる）。
 *
 *  - `pools` … その素材が持っている項目のまとまり。`kind` は行の呼び名に使う。
 *  - `targetId` … その画面の中の飛び先。まとめから直接そこへ行ける。
 */
export const DIGEST_SUBJECTS = [
  {
    id: 'adamski',
    title: '食べ合わせ（アダムスキー式）',
    reading: 'たべあわせあだむすきーしき',
    view: 'combine',
    source: ADAMSKI_SOURCE,
    sourceTargetId: 'combine-source',
    pools: {
      correction: { items: [], targetId: null },
      unverified: { items: ADAMSKI_UNVERIFIED, targetId: 'combine-unverified' },
    },
  },
  {
    id: 'fodmap',
    title: '低FODMAP の一覧',
    reading: 'ていふぉどまっぷのいちらん',
    view: 'fodmap',
    source: FODMAP_SOURCE,
    sourceTargetId: 'fodmap-source',
    pools: {
      correction: { items: [], targetId: null },
      unverified: { items: [], targetId: null },
    },
  },
  {
    id: 'redflags',
    title: '受診の目安の一覧',
    reading: 'じゅしんのめやすのいちらん',
    view: 'redflags',
    source: RED_FLAG_SOURCE,
    sourceTargetId: 'flag-source',
    pools: {
      correction: { items: [], targetId: null },
      unverified: { items: [], targetId: null },
      flag: { items: RED_FLAGS, targetId: 'flag-list' },
    },
  },
  {
    id: 'seasonings',
    title: '調味料の選び方',
    reading: 'ちょうみりょうのえらびかた',
    view: 'seasonings',
    source: SEASONING_SOURCE,
    sourceTargetId: 'seasoning-source',
    pools: {
      correction: { items: [], targetId: null },
      unverified: { items: [], targetId: null },
    },
  },
  {
    id: 'probiotics',
    title: '整腸剤',
    reading: 'せいちょうざい',
    view: 'probiotics',
    source: PROBIOTIC_SOURCE,
    sourceTargetId: 'probiotic-source',
    pools: {
      correction: { items: PROBIOTIC_CORRECTIONS, targetId: 'probiotic-corrections' },
      unverified: { items: PROBIOTIC_UNVERIFIED, targetId: 'probiotic-unverified' },
    },
  },
  {
    id: 'cleanup',
    title: '腸のお掃除',
    reading: 'ちょうのおそうじ',
    view: 'cleanup',
    source: CLEANUP_SOURCE,
    sourceTargetId: 'cleanup-source',
    pools: {
      correction: { items: CLEANUP_CORRECTIONS, targetId: 'cleanup-corrections' },
      unverified: { items: CLEANUP_UNVERIFIED, targetId: 'cleanup-unverified' },
      step: { items: CLEANUP_STEPS, targetId: 'cleanup-steps' },
      relief: { items: STRESS_RELIEF, targetId: 'cleanup-stress' },
    },
  },
  {
    id: 'prebiotics',
    title: '善玉菌の餌',
    reading: 'ぜんだまきんのえさ',
    view: 'prebiotics',
    source: PREBIOTIC_SOURCE,
    sourceTargetId: 'prebiotic-source',
    pools: {
      correction: { items: PREBIOTIC_CORRECTIONS, targetId: 'prebiotic-corrections' },
      unverified: { items: PREBIOTIC_UNVERIFIED, targetId: 'prebiotic-unverified' },
    },
  },
  {
    id: 'butyrate',
    title: '酪酸菌',
    reading: 'らくさんきん',
    view: 'butyrate',
    source: BUTYRATE_SOURCE,
    sourceTargetId: 'butyrate-source',
    pools: {
      correction: { items: BUTYRATE_CORRECTIONS, targetId: 'butyrate-corrections' },
      unverified: { items: BUTYRATE_UNVERIFIED, targetId: 'butyrate-unverified' },
      withdrawn: { items: WITHDRAWN, targetId: 'butyrate-withdrawn' },
      rumor: { items: BUTYRATE_RUMORS, targetId: 'butyrate-rumors' },
    },
  },
  {
    id: 'otc',
    title: '市販薬',
    reading: 'しはんやく',
    view: 'otc',
    source: OTC_SOURCE,
    sourceTargetId: 'otc-source',
    pools: {
      correction: { items: OTC_CORRECTIONS, targetId: 'otc-corrections' },
      unverified: { items: OTC_UNVERIFIED, targetId: 'otc-unverified' },
      kind: { items: OTC_KINDS, targetId: 'otc-kinds' },
    },
  },
  {
    id: 'magnesium',
    title: '寝る前のマグネシウム',
    reading: 'ねるまえのまぐねしうむ',
    view: 'otc',
    source: MAGNESIUM_SOURCE,
    sourceTargetId: 'magnesium-source',
    pools: {
      correction: { items: MAGNESIUM_CORRECTIONS, targetId: 'otc-magnesium' },
      unverified: { items: MAGNESIUM_UNVERIFIED, targetId: 'otc-magnesium' },
    },
  },
  {
    id: 'habits',
    title: '胃腸の習慣',
    reading: 'いちょうのしゅうかん',
    view: 'habits',
    source: HABIT_SOURCE,
    sourceTargetId: 'habit-source',
    pools: {
      correction: { items: HABIT_CORRECTIONS, targetId: 'habit-corrections' },
      unverified: { items: HABIT_UNVERIFIED, targetId: 'habit-unverified' },
    },
  },
  {
    id: 'alcohol',
    title: 'お酒',
    reading: 'おさけ',
    view: 'habits',
    source: ALCOHOL_SOURCE,
    sourceTargetId: 'alcohol-source',
    pools: {
      correction: { items: ALCOHOL_CORRECTIONS, targetId: 'habit-alcohol' },
      unverified: { items: ALCOHOL_UNVERIFIED, targetId: 'habit-alcohol' },
    },
  },
  {
    id: 'protein',
    title: 'タンパク質',
    reading: 'たんぱくしつ',
    view: 'protein',
    source: PROTEIN_SOURCE,
    sourceTargetId: 'protein-source',
    pools: {
      correction: { items: PROTEIN_CORRECTIONS, targetId: 'protein-corrections' },
      unverified: { items: PROTEIN_UNVERIFIED, targetId: 'protein-unverified' },
    },
  },
  {
    id: 'fasting',
    title: '断食・空腹',
    reading: 'だんじきくうふく',
    view: 'fasting',
    source: FASTING_SOURCE,
    sourceTargetId: 'fasting-source',
    pools: {
      correction: { items: FASTING_CORRECTIONS, targetId: 'fasting-corrections' },
      unverified: { items: FASTING_UNVERIFIED, targetId: 'fasting-unverified' },
      shape: { items: FASTING_SHAPES, targetId: 'fasting-shapes' },
    },
  },
  {
    id: 'morning',
    title: '朝のリズム',
    reading: 'あさのりずむ',
    view: 'morning',
    source: MORNING_SOURCE,
    sourceTargetId: 'morning-source',
    pools: {
      correction: { items: MORNING_CORRECTIONS, targetId: 'morning-corrections' },
      unverified: { items: MORNING_UNVERIFIED, targetId: 'morning-unverified' },
      habit: { items: MORNING_HABITS, targetId: 'morning-habits' },
    },
  },
  {
    id: 'scared',
    title: '名指しされた食べもの',
    reading: 'なざしされたたべもの',
    view: 'scared',
    source: SCARED_SOURCE,
    sourceTargetId: 'scared-source',
    pools: {
      correction: { items: SCARED_CORRECTIONS, targetId: 'scared-corrections' },
      unverified: { items: SCARED_UNVERIFIED, targetId: 'scared-unverified' },
    },
  },
  {
    id: 'diseases',
    title: 'お腹の病気の読み物',
    reading: 'おなかのびょうきのよみもの',
    view: 'diseases',
    source: DISEASE_SOURCE,
    sourceTargetId: 'disease-source',
    pools: {
      correction: { items: [], targetId: null },
      unverified: { items: [], targetId: null },
      disease: { items: DISEASES, targetId: 'disease-list' },
    },
  },
  {
    id: 'breathing',
    title: 'お腹の力を抜く',
    reading: 'おなかのちからをぬく',
    view: 'breathing',
    source: BREATHING_SOURCE,
    sourceTargetId: 'breath-source',
    pools: {
      correction: { items: [], targetId: null },
      unverified: { items: [], targetId: null },
      breath: { items: BREATH_STEPS, targetId: 'breath-steps' },
      massage: { items: MASSAGE_STEPS, targetId: 'breath-massage' },
    },
  },
  {
    id: 'ibscare',
    title: '型ごとにできること',
    reading: 'かたごとにできること',
    view: 'ibscare',
    source: CARE_SOURCE,
    sourceTargetId: 'care-source',
    pools: {
      correction: { items: [], targetId: null },
      unverified: { items: [], targetId: null },
      care: { items: CARE_BY_TYPE.map((c) => ({ ...c, id: c.typeId })), targetId: 'care-pick' },
    },
  },
  {
    id: 'eatingout',
    title: '外で食べるときの選び方',
    reading: 'そとでたべるときのえらびかた',
    view: 'eatingout',
    source: EATING_OUT_SOURCE,
    sourceTargetId: 'eatout-source',
    pools: {
      correction: { items: [], targetId: null },
      unverified: { items: [], targetId: null },
      eatout: { items: EATING_OUT_KINDS, targetId: 'eatout-list' },
    },
  },
  {
    id: 'flora',
    title: '腸内フローラの言葉',
    reading: 'ちょうないふろーらのことば',
    view: 'flora',
    source: FLORA_SOURCE,
    sourceTargetId: 'flora-source',
    pools: {
      correction: { items: FLORA_CORRECTIONS, targetId: 'flora-corrections' },
      unverified: { items: FLORA_UNVERIFIED, targetId: 'flora-unverified' },
      basic: { items: FLORA_BASICS, targetId: 'flora-basics' },
    },
  },
  {
    id: 'ibs',
    title: '過敏性腸症候群',
    reading: 'かびんせいちょうしょうこうぐん',
    view: 'ibs',
    source: IBS_SOURCE,
    sourceTargetId: 'ibs-source',
    pools: {
      correction: { items: IBS_CORRECTIONS, targetId: 'ibs-corrections' },
      unverified: { items: IBS_UNVERIFIED, targetId: 'ibs-unverified' },
      exclusion: { items: [IBS_EXCLUSION], targetId: 'ibs-exclusion' },
      approach: { items: IBS_APPROACHES, targetId: 'ibs-approaches' },
    },
  },
];

/** 行の呼び名。**「悪い」「良い」という言い方をしない**（層の名前だけ） */
export const POOL_LABELS = {
  correction: '訂正',
  unverified: '裏が取れていない主張',
  withdrawn: '出典が取り下げた説',
  rumor: '出回っているうわさ',
  step: '腸のお掃除の柱',
  relief: 'ストレス解消法',
  kind: '市販薬の種類',
  shape: '断食のかたち',
  habit: '朝の習慣',
  flag: '受診の目安',
  exclusion: '過敏性腸症候群の芯',
  approach: '出典が挙げるやり方',
  disease: '病気の説明',
  breath: 'お腹で息をする',
  massage: 'お腹をなでる',
  care: '型ごとにできること',
  eatout: '外で食べるときの見どころ',
  basic: '腸内フローラの言葉',
};

const subjectById = (id) => DIGEST_SUBJECTS.find((s) => s.id === id) || null;

/**
 * 項目の本文を、**その項目が持っている言い方のまま**取り出す。
 * 訂正は `correction`、取り下げは `withdrawn`、裏が取れていない主張は `note`、
 * それ以外は `body`／`said`。**ここで言い換えない**（言い換えると意味が変わる）。
 */
export function bodyOf(item, field) {
  if (field) return plain(item[field]);
  return plain(item.correction || item.withdrawn || item.note || item.body || item.said || item.instead || '');
}

/** 題は `title`、市販薬の種類だけ `name` を使っている（元データの言い方を変えない） */
export function titleOf(item) {
  return item.title || item.name || '';
}

/** 出典の言い分（あれば）。訂正・うわさの前に置くためのもの */
export function claimOf(item) {
  return plain(item.claim || item.rumor || '');
}

function rowsOfPool(subject, kind) {
  const pool = subject.pools[kind];
  if (!pool || !pool.items || pool.items.length === 0) return [];
  return pool.items.map((item) => ({
    key: `${subject.id}:${kind}:${item.id}`,
    subjectId: subject.id,
    subject: subject.title,
    kind,
    kindLabel: POOL_LABELS[kind] || kind,
    id: item.id,
    title: titleOf(item),
    reading: item.reading,
    claim: claimOf(item),
    body: bodyOf(item),
    view: subject.view,
    targetId: pool.targetId,
  }));
}

/** 訂正のまとめ（素材の順に並べる。**多い少ないで並べ替えない**） */
export function allCorrections() {
  return DIGEST_SUBJECTS.flatMap((s) => rowsOfPool(s, 'correction'));
}

/** 裏が取れていない主張のまとめ */
export function allUnverified() {
  return DIGEST_SUBJECTS.flatMap((s) => rowsOfPool(s, 'unverified'));
}

/** 出典が取り下げた説・出回っているうわさ（層が違うので訂正と混ぜない） */
export function allWithdrawnAndRumors() {
  return DIGEST_SUBJECTS.flatMap((s) => [...rowsOfPool(s, 'withdrawn'), ...rowsOfPool(s, 'rumor')]);
}

/** 素材ごとの内訳（**数えるだけ。順位も評価も付けない**） */
export function subjectBreakdown() {
  return DIGEST_SUBJECTS.map((s) => ({
    id: s.id,
    title: s.title,
    reading: s.reading,
    view: s.view,
    corrections: (s.pools.correction && s.pools.correction.items.length) || 0,
    unverified: (s.pools.unverified && s.pools.unverified.items.length) || 0,
    source: s.source,
    sourceTargetId: s.sourceTargetId,
  }));
}

export const BREAKDOWN_NOTE =
  '数えているだけです。訂正が多い素材が悪い、少ない素材が正しい、ということではありません。'
  + '長い話ほど確かめるところが増えます。';

// ───────────────────── 出典の一覧 ─────────────────────

/** 出典の一覧。**URL を書かない**（決まり・全アプリ共通）。確かめきれていないものは印を出す */
export function allSources() {
  return DIGEST_SUBJECTS.map((s) => ({
    id: s.id,
    subject: s.title,
    reading: s.reading,
    text: plain(s.source.text),
    check: Boolean(s.source.check),
    checkedOn: s.source.checkedOn || '',
    view: s.view,
    targetId: s.sourceTargetId,
  }));
}

export const SOURCES_NOTE =
  'このアプリの素材は、ほとんどが本や動画の要約です。原著・原論文はこちらでも確かめきれていないので、'
  + '「※要確認」の印を外していません。日付は、このアプリに取り込んだ日です。'
  + 'リンクは置いていません——確かめられない状態でそれらしいURLを書くのが、この題材でいちばんの事故だからです。';

// ───────────────────── 食い違いのまとめ ─────────────────────

/**
 * このアプリが**両方そのまま見せている**ところの一覧。
 * 中身は `conflicts.js` が元データから毎回導くので、ここは**どこに置いてあるか**だけを持つ。
 * 件数も毎回数える（書き写さない）。
 */
export const CONFLICT_TOPICS = [
  {
    id: 'combine',
    title: '低FODMAP と食べ合わせの食い違い',
    reading: 'ていふぉどまっぷとたべあわせのくいちがい',
    note: CONFLICT_NOTE,
    view: 'combine',
    targetId: 'combine-conflicts',
    count: () => conflictFoods().length,
  },
  {
    id: 'ferment',
    title: '発酵食品を3つの考え方から見る',
    reading: 'はっこうしょくひんをみっつのかんがえかたからみる',
    note: FERMENT_NOTE,
    view: 'cleanup',
    targetId: 'cleanup-ferment',
    count: () => fermentViews().length,
  },
  {
    id: 'prebiotic',
    title: '善玉菌の餌と低FODMAP の食い違い',
    reading: 'ぜんだまきんのえさとていふぉどまっぷのくいちがい',
    note: PREBIOTIC_VS_FODMAP_NOTE,
    view: 'prebiotics',
    targetId: 'prebiotic-vs-fodmap',
    count: () => prebioticConflicts().length,
  },
  {
    id: 'fiber',
    title: '食物繊維は見ている場所で言うことが変わる',
    reading: 'しょくもつせんいはみているばしょでいうことがかわる',
    note: FIBER_NOTE,
    view: 'habits',
    targetId: 'habit-fiber',
    count: () => fiberViews().length,
  },
  {
    id: 'fiber_within',
    title: '同じ出典の中でも食物繊維の話が割れている',
    reading: 'おなじしゅってんのなかでもしょくもつせんいのはなしがわれている',
    note: FIBER_NOTE,
    view: 'habits',
    targetId: 'habit-fiber',
    count: () => (withinSourceFiberConflict() ? 1 : 0),
  },
  {
    id: 'protein',
    title: 'タンパク質と、胃腸が弱っているときの食い違い',
    reading: 'たんぱくしつといちょうがよわっているときのくいちがい',
    note: PROTEIN_NOTE,
    view: 'protein',
    targetId: 'protein-vs-stomach',
    count: () => proteinViews().length,
  },
  {
    id: 'dairy',
    title: '乳製品の食い違い',
    reading: 'にゅうせいひんのくいちがい',
    note: DAIRY_NOTE,
    view: 'protein',
    targetId: 'protein-dairy',
    count: () => dairyViews().length,
  },
  {
    id: 'breakfast',
    title: '朝ごはんを食べるかどうかの食い違い',
    reading: 'あさごはんをたべるかどうかのくいちがい',
    note: BREAKFAST_NOTE,
    view: 'morning',
    targetId: 'morning-breakfast',
    count: () => breakfastViews().length,
  },
  {
    id: 'tsukemono',
    title: '漬物の食い違い',
    reading: 'つけもののくいちがい',
    note: TSUKEMONO_NOTE,
    view: 'scared',
    targetId: 'scared-tsukemono',
    count: () => tsukemonoViews().length,
  },
  {
    id: 'fasting_allowed',
    title: '空腹の時間に口にしてよいものの食い違い',
    reading: 'くうふくのじかんにくちにしてよいもののくいちがい',
    note: FASTING_ALLOWED_CLASH_NOTE,
    view: 'fasting',
    targetId: 'fasting-allowed',
    count: () => fastingAllowedViews().length,
  },
  {
    id: 'ibs_ferment',
    title: '胃腸が弱っているときの発酵食品',
    reading: 'いちょうがよわっているときのはっこうしょくひん',
    note: IBS_FERMENT_NOTE,
    view: 'ibs',
    targetId: 'ibs-ferment',
    count: () => ibsFermentViews().length,
  },
  {
    id: 'mealgap',
    title: '同じ「4時間」が3つの別々の理由から出てくる',
    reading: 'おなじよじかんがみっつのべつべつのりゆうからでてくる',
    note: MEAL_GAP_CONFLICT_NOTE,
    view: 'ibs',
    targetId: 'ibs-mealgap',
    count: () => mealGapViews().length,
  },
];

/** 件数まで数えた食い違いの一覧 */
export function allConflictTopics() {
  return CONFLICT_TOPICS.map((t) => ({
    id: t.id,
    title: t.title,
    reading: t.reading,
    note: plain(t.note),
    view: t.view,
    targetId: t.targetId,
    count: t.count(),
  }));
}

export const CONFLICTS_NOTE =
  'ここに並んでいるのは、考え方によって言うことが反対になるところです。'
  + 'このアプリはどちらが正しいかを決めません。決めた時点で、決めた側の根拠をアプリが持っていることになるからです。'
  + '合うかどうかは、しばらく試して自分の記録で見つけてください。';

// ───────────────────── 扱わないこと ─────────────────────

/** **このアプリが引き受けない範囲。** 3か所に分かれていたものを、ここから横に見られるようにする */
export const SCOPE_NOTES = [
  {
    id: 'ibs',
    title: '過敏性腸症候群で扱わないこと',
    reading: 'かびんせいちょうしょうこうぐんであつかわないこと',
    body: plain(`${IBS_OUT_OF_SCOPE.body} ${IBS_OUT_OF_SCOPE.note}`),
    view: 'ibs',
    targetId: 'ibs-scope',
  },
  {
    id: 'supplement',
    title: 'サプリで扱わないこと',
    reading: 'さぷりであつかわないこと',
    body: plain(SUPPLEMENT_SCOPE_NOTE),
    view: 'probiotics',
    targetId: 'probiotic-scope',
  },
  {
    id: 'magnesium',
    title: 'マグネシウムで扱わないこと',
    reading: 'まぐねしうむであつかわないこと',
    body: plain(MAGNESIUM_SCOPE_NOTE),
    view: 'otc',
    targetId: 'otc-magnesium',
  },
];

export const SCOPE_NOTE =
  'このアプリはお腹の記録アプリで、健康情報のすべてを引き受ける場所ではありません。'
  + '扱わないと決めたところは、黙って落とさずここに書いておきます。'
  + '扱わないのは「そんなものは無い」という意味ではなく、確かめる手立ても記録する形も持っていない、という意味です。';

// ───────────────────── 横断のまとまり ─────────────────────

/**
 * 素材をまたいで同じ話が出てくるところを集める場所。
 * **どの項目を集めるかは手で書く**（語の一致で拾わない）。
 * 新しい素材でこの話が出てきたら、`refs` に1行足すだけで増える。
 */
export const CROSS_TOPICS = [
  {
    id: 'testing',
    title: '検査の話（腸内フローラ検査・自費の検査）',
    reading: 'けんさのはなしちょうないふろーらけんさじひのけんさ',
    lead: '自分でお金を出して受ける検査の話が、いくつかの素材に出てきます。ここに集めておきます。',
    note:
      'このアプリは検査を勧めません。結果から食べるもの・飲む菌を決められるところまでは来ていないからです。'
      + '気になる症状があるときに先に行くのは、自費の検査ではなく医療機関です。',
    refs: [
      { subject: 'ibs', kind: 'exclusion', id: 'exclusion' },
      { subject: 'ibs', kind: 'correction', id: 'test_first' },
      { subject: 'protein', kind: 'correction', id: 'igg' },
      { subject: 'probiotics', kind: 'unverified', id: 'four_years' },
      { subject: 'ibs', kind: 'correction', id: 'self_import' },
      { subject: 'ibs', kind: 'unverified', id: 'sibo_85' },
    ],
    link: { view: 'redflags', targetId: 'flag-list', label: '受診の目安を見る' },
  },
  {
    id: 'stress',
    title: 'ストレスと自律神経の話',
    reading: 'すとれすとじりつしんけいのはなし',
    lead: 'お腹と気持ちのつながりは、ほとんどの素材が触れます。言い方の強さもばらばらなので、横に並べます。',
    note:
      'ストレスをお腹の原因と決めることも、お腹の不調を気持ちの問題にすることも、このアプリはしません。'
      + '記録できるのは「その日どうだったか」の段までで、心のつらさが続くときは腸で様子を見ずに医療機関へ。',
    refs: [
      { subject: 'cleanup', kind: 'step', id: 'stress' },
      { subject: 'cleanup', kind: 'relief', id: 'move' },
      { subject: 'cleanup', kind: 'relief', id: 'mindful' },
      { subject: 'cleanup', kind: 'correction', id: 'serotonin_pool' },
      { subject: 'cleanup', kind: 'correction', id: 'depression' },
      { subject: 'cleanup', kind: 'unverified', id: 'serotonin90' },
      { subject: 'prebiotics', kind: 'unverified', id: 'neurotransmitter' },
      { subject: 'probiotics', kind: 'unverified', id: 'mental' },
      { subject: 'morning', kind: 'unverified', id: 'stress18' },
      { subject: 'ibs', kind: 'unverified', id: 'serotonin_threshold' },
      { subject: 'ibs', kind: 'correction', id: 'psych' },
    ],
    link: { view: 'home', targetId: 'rec-life', label: 'きょうのストレスを記録する' },
  },
  {
    id: 'water',
    title: '水分の話',
    reading: 'すいぶんのはなし',
    lead: '水を飲む話は、朝のリズム・断食・市販薬と、ちがう文脈で出てきます。',
    note:
      '1日に何リットル、という目安はこのアプリでは持ちません（手元に無い基準だからです）。'
      + '水分を制限するように言われている持病がある人は、量を変える前に医師に聞いてください。'
      + '水が飲めないときは、様子を見ずに医療機関へ。',
    refs: [
      { subject: 'morning', kind: 'habit', id: 'water' },
      { subject: 'fasting', kind: 'shape', id: 'morning_water' },
      { subject: 'otc', kind: 'kind', id: 'antidiarrheal', field: 'instead' },
      { subject: 'otc', kind: 'kind', id: 'antiemetic', field: 'instead' },
      { subject: 'otc', kind: 'kind', id: 'magnesium', field: 'why' },
    ],
    link: { view: 'redflags', targetId: 'flag-list', label: '受診の目安を見る' },
  },
  {
    id: 'weight',
    title: '体重・やせる話',
    reading: 'たいじゅうやせるはなし',
    lead: '腸活の素材には「やせる」がよく出てきます。このアプリが引き受けないところなので、理由をここにまとめます。',
    note:
      'このアプリは体重も体型も記録しません。お腹の記録を、やせるための成績表にしないためです。'
      + 'ただし、思いあたる理由がないのに体重が減っているときは別です。それは受診の目安のほうに置いてあります。',
    refs: [
      { subject: 'butyrate', kind: 'withdrawn', id: 'fat_thin_bacteria' },
      { subject: 'butyrate', kind: 'unverified', id: 'diet_three' },
      { subject: 'butyrate', kind: 'unverified', id: 'longevity' },
      { subject: 'alcohol', kind: 'unverified', id: 'obesity134' },
      { subject: 'fasting', kind: 'unverified', id: 'twelve_weeks' },
      { subject: 'redflags', kind: 'flag', id: 'weight' },
    ],
    link: { view: 'redflags', targetId: 'flag-list', label: '受診の目安を見る' },
  },
];

/**
 * まとまり1つぶんの行。**参照が見つからなければ、そのぶんは黙って落とす**
 * （元データから項目を消したときに、まとめ側が落ちないようにするため）。
 */
export function crossTopicRows(topic) {
  const out = [];
  for (const ref of topic.refs) {
    const subject = subjectById(ref.subject);
    if (!subject) continue;
    const pool = subject.pools[ref.kind];
    if (!pool) continue;
    const item = pool.items.find((x) => x.id === ref.id);
    if (!item) continue;
    out.push({
      key: `${topic.id}:${ref.subject}:${ref.kind}:${ref.id}`,
      subjectId: subject.id,
      subject: subject.title,
      kind: ref.kind,
      kindLabel: POOL_LABELS[ref.kind] || ref.kind,
      id: item.id,
      title: titleOf(item),
      reading: item.reading,
      claim: claimOf(item),
      body: bodyOf(item, ref.field),
      view: subject.view,
      targetId: pool.targetId,
    });
  }
  return out;
}

/** 中身が1件でもあるまとまりだけ（**空箱を作らない**） */
export function crossTopics() {
  return CROSS_TOPICS.map((t) => ({ ...t, rows: crossTopicRows(t) })).filter((t) => t.rows.length > 0);
}

export const CROSS_NOTE =
  'ここは、素材をまたいで同じ話が出てくるところを集めた場所です。'
  + '新しい素材で同じ話が出てきたら、ここに足していきます。'
  + '集めてあるだけで、どれが正しいかを決めているわけではありません。';

// ───────────────────── 全体 ─────────────────────

export function digestCounts() {
  const sources = allSources();
  return {
    subjects: DIGEST_SUBJECTS.length,
    corrections: allCorrections().length,
    unverified: allUnverified().length,
    withdrawnAndRumors: allWithdrawnAndRumors().length,
    conflicts: CONFLICT_TOPICS.length,
    scope: SCOPE_NOTES.length,
    sources: sources.length,
    sourcesNeedCheck: sources.filter((s) => s.check).length,
    crossTopics: crossTopics().length,
  };
}

export const DIGEST_NOTE =
  'このアプリに入っている素材は、動画や本の要約です。1本ずつ別の画面に入れてきたので、'
  + '同じ種類のもの（訂正・裏が取れていない主張・食い違い・出典）が散らばっていました。ここは横に並べて見る場所です。'
  + '中身はそれぞれの画面と同じものを毎回集めているだけなので、片方だけ古くなることはありません。';
