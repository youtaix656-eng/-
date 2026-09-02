// 網羅マップ（#1）用のロジック。
// 「出題基準の大項目 × 収録数」を全13科目について集計し、手薄な所を可視化する。

import { EXAM_SUBJECTS, EXAM_SESSIONS, subjectMatches } from '../data/examScope.js';
import { genreOf, daikoumoku } from './genreClassification.js';

export { daikoumoku };

// 手薄／充実の既定しきい値（#2・#28：settings.coverageThinThreshold/coverageRichThresholdで
// 上書きできる。出題基準の大項目数が分かる科目（現状は医療概論のみ）は、そこから目安を
// 自動計算する＝#28。無い科目は素直に既定値を使う（無い情報から推測しない）。
export const DEFAULT_THIN_THRESHOLD = 20;
export const DEFAULT_RICH_THRESHOLD = 60;

// 出題基準の大項目数から「大項目1件あたり◯問」の目安でしきい値を計算する（#28）。
// outlineが無い科目は自動計算できないのでnullを返す（呼び出し側は既定値にフォールバック）。
export function suggestedThresholds(outline) {
  if (!Array.isArray(outline) || outline.length === 0) return null;
  const n = outline.length;
  return { thin: n * 4, rich: n * 12 };
}

function thresholdsFor(subj, opts = {}) {
  const auto = suggestedThresholds(subj.outline);
  return {
    thin: opts.thin ?? auto?.thin ?? DEFAULT_THIN_THRESHOLD,
    rich: opts.rich ?? auto?.rich ?? DEFAULT_RICH_THRESHOLD,
    auto: !!auto && opts.thin == null && opts.rich == null,
  };
}

// 全13科目の網羅状況を返す。
//   [{ id, name, session, category, outline, total, answered, correct, groups: [{name,count,subgroups}],
//      thinThreshold, richThreshold, thresholdIsAuto, format: {original, derived, withImage} }]
// opts.thin/opts.rich を渡すと全科目共通のしきい値で上書きできる（#2。settings.coverageThinThreshold等）。
export function coverageBySubject(questions, history = [], opts = {}) {
  const answeredById = new Map();
  history.forEach((h) => {
    const cur = answeredById.get(h.questionId) || { a: 0, c: 0 };
    cur.a += 1;
    if (h.correct) cur.c += 1;
    answeredById.set(h.questionId, cur);
  });

  return EXAM_SUBJECTS.map((subj) => {
    const inBank = questions.filter((x) => subjectMatches(x.subject, subj));
    // 大項目→中項目 の2段で集計（#1：中項目までの内訳。公式のoutlineが無い科目でも、
    // 収録済み問題自身のgenre/タグから復元できる中項目までは表示する＝実在するデータの範囲で示す）。
    const gmap = new Map(); // daikoumoku -> { count, subgroups: Map(genre -> count) }
    let answered = 0;
    let correct = 0;
    let original = 0; // 原問（round設定あり）
    let withImage = 0; // 画像／図つき
    inBank.forEach((q) => {
      // genreOf()は医療概論のようにgenreを持たない科目でもtagsから大項目｜中項目を復元する
      // （以前はq.genreを直接見ていたため、医療概論だけ常に「（未分類）」に丸められていた）。
      const genre = genreOf(q);
      const k = daikoumoku(genre);
      if (!gmap.has(k)) gmap.set(k, { count: 0, subgroups: new Map() });
      const g = gmap.get(k);
      g.count += 1;
      if (genre && genre.includes('｜')) {
        const mid = genre.split('｜')[1]?.trim();
        if (mid) g.subgroups.set(mid, (g.subgroups.get(mid) || 0) + 1);
      }
      const a = answeredById.get(q.id);
      if (a) {
        answered += a.a;
        correct += a.c;
      }
      if (q.round != null) original += 1;
      if (q.image || q.figure) withImage += 1;
    });
    const groups = [...gmap.entries()]
      .map(([name, g]) => ({
        name,
        count: g.count,
        subgroups: [...g.subgroups.entries()].map(([n, c]) => ({ name: n, count: c })).sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.count - a.count);
    const { thin, rich, auto } = thresholdsFor(subj, opts);
    return {
      id: subj.id,
      name: subj.name,
      session: subj.session,
      category: subj.category,
      outline: subj.outline || null,
      total: inBank.length,
      answered,
      correct,
      accuracy: answered > 0 ? correct / answered : null,
      groups,
      thinThreshold: thin,
      richThreshold: rich,
      thresholdIsAuto: auto,
      format: { original, derived: inBank.length - original, withImage },
    };
  });
}

// 収録数から充実度レベルを返す（birds-eye の色分け）
//   0=未収録 / 1..=手薄 / 多い=充実
export function coverageLevel(count, { thin = DEFAULT_THIN_THRESHOLD, rich = DEFAULT_RICH_THRESHOLD } = {}) {
  if (count <= 0) return 'none';
  if (count < thin) return 'thin';
  if (count < rich) return 'ok';
  return 'rich';
}

// 「あと何問で手薄を脱するか」の目安（#5）。すでに脱していれば0。
export function neededToExitThin(row) {
  return Math.max(0, row.thinThreshold - row.total);
}

// 全体サマリ（#8：充足率＝手薄でも未収録でもない科目の割合、を1つの数値にまとめる）
export function coverageSummary(rows) {
  const withData = rows.filter((r) => r.total > 0).length;
  const total = rows.reduce((s, r) => s + r.total, 0);
  const none = rows.filter((r) => r.total === 0);
  const thin = rows.filter((r) => r.total > 0 && r.total < r.thinThreshold);
  const filled = rows.length - none.length - thin.length;
  const fillRatio = rows.length > 0 ? filled / rows.length : 0;
  return { subjects: rows.length, withData, total, none, thin, filled, fillRatio };
}

export { EXAM_SESSIONS };
