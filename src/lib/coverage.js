// 網羅マップ（#1）用のロジック。
// 「出題基準の大項目 × 収録数」を全13科目について集計し、手薄な所を可視化する。

import { EXAM_SUBJECTS, EXAM_SESSIONS, subjectMatches } from '../data/examScope.js';

// genre（"大項目｜中項目"）から大項目を取り出す
function daikoumoku(genre) {
  const g = String(genre || '').trim();
  if (!g) return '（未分類）';
  return g.split('｜')[0].trim() || '（未分類）';
}

// 全13科目の網羅状況を返す。
//   [{ id, name, session, category, outline, total, answered, correct, groups: [{name,count}] }]
export function coverageBySubject(questions, history = []) {
  const answeredById = new Map();
  history.forEach((h) => {
    const cur = answeredById.get(h.questionId) || { a: 0, c: 0 };
    cur.a += 1;
    if (h.correct) cur.c += 1;
    answeredById.set(h.questionId, cur);
  });

  return EXAM_SUBJECTS.map((subj) => {
    const inBank = questions.filter((x) => subjectMatches(x.subject, subj));
    // 大項目ごとに集計
    const gmap = new Map();
    let answered = 0;
    let correct = 0;
    inBank.forEach((q) => {
      const k = daikoumoku(q.genre);
      gmap.set(k, (gmap.get(k) || 0) + 1);
      const a = answeredById.get(q.id);
      if (a) {
        answered += a.a;
        correct += a.c;
      }
    });
    const groups = [...gmap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
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
    };
  });
}

// 収録数から充実度レベルを返す（birds-eye の色分け）
//   0=未収録 / 1..=手薄 / 多い=充実
export function coverageLevel(count) {
  if (count <= 0) return 'none';
  if (count < 20) return 'thin';
  if (count < 60) return 'ok';
  return 'rich';
}

// 全体サマリ
export function coverageSummary(rows) {
  const withData = rows.filter((r) => r.total > 0).length;
  const total = rows.reduce((s, r) => s + r.total, 0);
  const none = rows.filter((r) => r.total === 0);
  const thin = rows.filter((r) => r.total > 0 && r.total < 20);
  return { subjects: rows.length, withData, total, none, thin };
}

export { EXAM_SESSIONS };
