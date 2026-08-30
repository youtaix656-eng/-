// 目次（あ〜ん / A〜Z 索引）— アプリ内のすべての項目を1つの一覧に集める。
//
// **各データファイルから自動生成する。書き写さない**（二重管理＝食い違いの元）。
// 追加する時の約束（全アプリ共通の目次ルール）:
//   - タイトルは重複させない。重複は toc.test.mjs が検出して落とす。
//   - 漢字を含むなら reading（ひらがな）をデータ側に必ず書く。**自動推定しない。**
//     読みが無いものは「その他」に落ちる＝入れ忘れが目に見える（テストが数える）。
//   - 数字は読みに変換して五十音へ振り分ける（yomi.js が面倒を見る）。
//   - 飛び先（view）は実在すること。これもテストで検査する。

import { EXAMS, EXAM_CATEGORIES, TRAIT_VOCABULARY, FORMAT_VOCABULARY } from './exams.js';
import { METHODS } from './methods.js';
import { CHANNELS, ORDERS } from './cognitiveQuestions.js';
import { PHASE_META, PHASE_ORDER } from '../lib/schedule.js';
import { ANGLES } from '../lib/convert.js';
import { buildKanaIndex } from '../lib/yomi.js';

/** 目次のカテゴリ（表示順・色分け） */
export const TOC_CATEGORIES = [
  { id: 'exam', label: '資格試験', icon: '🎓', view: 'exams' },
  { id: 'subject', label: '科目', icon: '📗', view: 'exams' },
  { id: 'method', label: '勉強法', icon: '🧠', view: 'plan' },
  { id: 'phase', label: '時期', icon: '📆', view: 'plan' },
  { id: 'angle', label: '変換の角度', icon: '🔁', view: 'convert' },
  { id: 'trait', label: '試験の性格', icon: '🏷', view: 'exams' },
  { id: 'format', label: '出題形式', icon: '✍️', view: 'convert' },
  { id: 'cognitive', label: '認知特性', icon: '👤', view: 'plan' },
];

export const TOC_CATEGORY_MAP = Object.fromEntries(TOC_CATEGORIES.map((c) => [c.id, c]));

/** 飛び先として認めている画面（App.jsx の view と一致させる。テストが照合する） */
export const TOC_VIEWS = ['home', 'exams', 'convert', 'plan', 'spec', 'toc', 'settings'];

/**
 * 目次の項目をすべて作る。
 * reading を持たない項目は「その他」に落ちる（＝入れ忘れが見える）。
 */
export function buildTocItems() {
  const items = [];

  // 資格試験
  for (const e of EXAMS) {
    items.push({
      title: e.name,
      reading: e.reading,
      category: 'exam',
      view: 'exams',
      anchor: `exam-${e.id}`,
      sub: `${EXAM_CATEGORIES.find((c) => c.id === e.category)?.label || ''}${e.body ? ` ／ ${e.body}` : ''}`,
    });
  }

  // 科目（同じ名前の科目が複数の試験にあるので、試験名を添えて重複を避ける）
  const subjectSeen = new Map();
  for (const e of EXAMS) {
    for (const s of e.subjects || []) {
      const key = s.name;
      const dup = subjectSeen.get(key);
      subjectSeen.set(key, (dup || 0) + 1);
      items.push({
        title: dup ? `${s.name}（${e.name}）` : s.name,
        reading: dup && s.reading ? `${s.reading}${e.reading}` : s.reading,
        category: 'subject',
        view: 'exams',
        anchor: `exam-${e.id}`,
        sub: e.name,
      });
    }
  }

  // 勉強法
  for (const m of METHODS) {
    items.push({
      title: m.title,
      reading: m.reading,
      category: 'method',
      view: 'plan',
      anchor: `method-${m.id}`,
      sub: m.summary,
    });
  }

  // 時期（フェーズ）
  for (const id of PHASE_ORDER) {
    const p = PHASE_META[id];
    items.push({ title: p.label, reading: p.reading, category: 'phase', view: 'plan', anchor: `phase-${id}`, sub: p.aim });
  }

  // 変換の角度
  for (const a of ANGLES) {
    items.push({ title: a.label, reading: a.reading, category: 'angle', view: 'convert', anchor: `angle-${a.id}`, sub: a.desc });
  }

  // 試験の性格
  for (const [id, t] of Object.entries(TRAIT_VOCABULARY)) {
    items.push({ title: t.label, reading: TRAIT_READINGS[id] || '', category: 'trait', view: 'exams', anchor: `trait-${id}`, sub: t.hint });
  }

  // 出題形式
  for (const [id, f] of Object.entries(FORMAT_VOCABULARY)) {
    items.push({ title: f.label, reading: FORMAT_READINGS[id] || '', category: 'format', view: 'convert', anchor: `format-${id}`, sub: f.hint });
  }

  // 認知特性
  for (const c of Object.values(CHANNELS)) {
    items.push({ title: c.label, reading: c.reading, category: 'cognitive', view: 'plan', anchor: 'cognitive', sub: '学習の入り口（自己申告）' });
  }
  for (const o of Object.values(ORDERS)) {
    items.push({ title: o.label, reading: o.reading, category: 'cognitive', view: 'plan', anchor: 'cognitive', sub: '進め方の好み（自己申告）' });
  }

  return items;
}

/**
 * 試験の性格・出題形式の読み。
 * ラベルは exams.js が持つが、**読みは推定しない**のでここに明示する。
 * exams.js に語彙を足したら、ここにも読みを足すこと（テストが機械チェックする）。
 */
export const TRAIT_READINGS = {
  memory: 'あんきりょうがおおい',
  wide: 'はんいがひろい',
  law: 'ほうれいかいせいがからむ',
  calc: 'けいさんがある',
  case: 'じれいおうようがでる',
  essay: 'きじゅつろんじゅつがある',
  practical: 'じつぎがある',
  oral: 'こうじゅつめんせつがある',
  speed: 'じかんがたりなくなりやすい',
  update: 'とうけいすうちがまいとしうごく',
};

export const FORMAT_READINGS = {
  choice: 'たくいつまーくしーと',
  multi: 'たしせんたくくみあわせ',
  ox: 'まるばつ',
  essay: 'きじゅつろんじゅつ',
  practical: 'じつぎ',
  oral: 'こうじゅつめんせつ',
};

/** 五十音の索引にしたもの（画面はこれをそのまま並べる） */
export function buildToc() {
  return buildKanaIndex(buildTocItems());
}
