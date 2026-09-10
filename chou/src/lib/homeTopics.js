// ホームに常設する2つのまとまり（ユーザー指定・2026-09-03）。
//
//  1. **整腸剤** — 今後、整腸剤の情報が出たときに集まる場所。
//  2. **あなたに向いた腸活** — その中に**酪酸菌まとめ**を置く。
//     今後、酪酸菌の情報が出たときに積み上がる場所。
//
// **中身はすべて元データから毎回導く**（ホーム専用の手書きの一覧を作らない。
// README 決まり11と同じ線。書き写すと、片方だけ直したときに黙って食い違う）。
//
// **「あなたに向いた」でも、どれが向いているかをアプリが決めない**（決まり1・4）。
// 出すのは「読んで自分で選ぶための材料」と、いま自分が記録していることだけ。

import {
  BACTERIA,
  PRODUCTS,
  PROBIOTIC_CORRECTIONS,
  PROBIOTIC_UNVERIFIED,
  PROBIOTIC_FAQ,
  PROBIOTIC_PRECHECKS,
  TRIAL_NOTE,
  NO_INTERACTION_CHECK,
  PROBIOTIC_SOURCE,
} from '../data/probiotics.js';
import { OTC_KINDS } from '../data/otcDrugs.js';
import {
  SHORT_CHAIN,
  SPORE,
  BUTYRATE_ROLES,
  WITHDRAWN,
  BUTYRATE_CORRECTIONS,
  BUTYRATE_UNVERIFIED,
  BUTYRATE_SOURCE,
} from '../data/butyrate.js';
import { isRegistered, trialProgress, trialLine } from './probiotic.js';
import { todayKey } from './dates.js';

// ───────────────────────── 整腸剤 ─────────────────────────

/**
 * ホームの整腸剤の項目に出すもの。
 *  - `line` … 登録していれば試している期間の一言、していなければ登録をすすめる一言
 *  - `takenToday` … きょう飲んだ印が付いているか（**良し悪しは見ない**）
 *  - `counts` … いま収録されている整腸剤の情報の内訳（元データから毎回数える）
 *
 * **飲めなかった日を数えない・採点しない**（決まり5）。
 */
export function probioticHome(probiotic, days, today = todayKey()) {
  const registered = isRegistered(probiotic);
  const progress = trialProgress(probiotic, days || {}, today);
  const day = (days || {})[today];
  const otc = OTC_KINDS.find((k) => k.id === 'probiotic') || null;
  return {
    registered,
    name: registered ? probiotic.name : '',
    line: trialLine(progress),
    reached: Boolean(progress.reached),
    takenToday: Boolean(day && day.probiotic),
    counts: {
      bacteria: BACTERIA.length,
      products: PRODUCTS.length,
      corrections: PROBIOTIC_CORRECTIONS.length,
      unverified: PROBIOTIC_UNVERIFIED.length,
      faq: PROBIOTIC_FAQ.length,
      prechecks: PROBIOTIC_PRECHECKS.length,
    },
    trialNote: TRIAL_NOTE,
    interactionNote: NO_INTERACTION_CHECK,
    otcNote: otc ? otc.doctor : '',
    source: PROBIOTIC_SOURCE,
  };
}

/** 整腸剤の項目に必ず添える一文。**勧めない・順位を付けない**（決まり19） */
export const PROBIOTIC_HOME_NOTE =
  'このアプリは整腸剤の商品を勧めません。順位も付けません。'
  + '合う・合わないは人によって違うので、しばらく試して自分の記録で見てください。'
  + '飲み合わせはこのアプリでは調べません——箱を持って薬剤師に聞くのがいちばん確かです。';

// ───────────────────────── 酪酸菌まとめ ─────────────────────────

/**
 * 酪酸菌まとめ。**元データから毎回導く**ので、
 * `data/butyrate.js` に足せばここも自動で増える（ユーザー指定の積み上げ場所）。
 */
export function butyrateSummary() {
  return {
    shortChain: SHORT_CHAIN.map((s) => ({ id: s.id, name: s.name, note: s.note })),
    spore: { title: SPORE.title, body: SPORE.body, caution: SPORE.caution },
    roles: BUTYRATE_ROLES.map((r) => ({ id: r.id, title: r.title })),
    withdrawn: WITHDRAWN.map((w) => ({ id: w.id, title: w.title })),
    counts: {
      shortChain: SHORT_CHAIN.length,
      roles: BUTYRATE_ROLES.length,
      withdrawn: WITHDRAWN.length,
      corrections: BUTYRATE_CORRECTIONS.length,
      unverified: BUTYRATE_UNVERIFIED.length,
    },
    source: BUTYRATE_SOURCE,
  };
}

export const BUTYRATE_SUMMARY_NOTE =
  '出典が「そう説明している」というところまでです。'
  + '**出典自身が取り下げた説**（痩せ菌・デブ菌）も、取り下げの経緯ごと残してあります。'
  + '酪酸菌の話が新しく増えたときは、ここに積み上がります。';

// ───────────────────────── あなたに向いた腸活 ─────────────────────────

/**
 * 「あなたに向いた腸活」に並べるまとまり。
 * いまは酪酸菌まとめの1件（ユーザー指定）。**足すときはこの配列に1件足すだけ**で、
 * ホームの画面に if を書き足さない。
 */
export const GUT_CARE_TOPICS = [
  {
    id: 'butyrate',
    title: '酪酸菌まとめ',
    reading: 'らくさんきんまとめ',
    lead: '短鎖脂肪酸・芽胞・出典が挙げるはたらき・取り下げられた説を、1か所にまとめたもの。',
    view: 'butyrate',
    targetId: 'butyrate-roles',
    label: '酪酸菌の画面をひらく',
    // **画面はこの3つを読むだけ**（まとまりごとの if をホームに書かない）。
    // 新しいまとまりを足すときも、同じ形の `rows`／`note`／`source` を返せばよい。
    rows: butyrateRows,
    note: BUTYRATE_SUMMARY_NOTE,
    source: () => BUTYRATE_SOURCE,
  },
];

/**
 * 酪酸菌まとめとして画面に出す行。**元データから毎回作る**ので、
 * `data/butyrate.js` に足せばここも自動で増える。
 */
function butyrateRows() {
  const s = butyrateSummary();
  return [
    {
      id: 'counts',
      title: 'いま入っているもの',
      lines: [
        `短鎖脂肪酸 ${s.counts.shortChain}／出典が挙げるはたらき ${s.counts.roles}`,
        `出典自身が取り下げた説 ${s.counts.withdrawn}／そのままにできないところ ${s.counts.corrections}`
          + `／裏が取れていない主張 ${s.counts.unverified}`,
      ],
    },
    ...s.shortChain.map((c) => ({ id: `chain-${c.id}`, title: c.name, lines: [c.note] })),
    { id: 'spore', title: s.spore.title, lines: [s.spore.body, s.spore.caution] },
    ...s.withdrawn.map((w) => ({
      id: `withdrawn-${w.id}`,
      title: w.title,
      lines: ['出典自身が取り下げた説として残してあります。'],
    })),
  ];
}

/**
 * 「あなたに向いた」でも判定しないことを、必ず添える一文。
 * **ここを外すと、この項目はそのまま「アプリが向き不向きを決める機能」になる。**
 */
export const GUT_CARE_NOTE =
  'どれが向いているかを、このアプリが決めることはしません。'
  + 'ここに置いてあるのは、読んで自分で選ぶための材料です。'
  + '合う・合わないは、しばらく試して自分の記録で見つけてください。';
