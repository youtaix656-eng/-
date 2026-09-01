// 「○（完璧）」にした問題のプール。
//   自己採点で最後に○を選んだ問題だけを対象にし、次の使い道に使う：
//   ①問題演習で見直す（本当に理解していて○にしたか、適当に○にしていないかの確認）
//   ②高速回転でインプット強化（もう分かっている内容を素早く回して記憶を固める）
//   ③溜まったら知らせる（Home.jsx）④得意科目の分析（Analytics.jsx）
//   ⑤直前期の総ざらい（ExamDayChecklist.jsx）
// あとで△・✕に変わっていれば、最新の記録がそちらになるので自動的にこのプールから外れる。

import { isMastered } from './srs.js';

// questionId → 最新の自己採点（selfKindが付いた履歴のみ。gradeMode等selfKindの無い記録は無視）。
// objectiveCorrectは選択肢の客観的な正誤（QuestionCard.jsxの#1/#2）。うっかり○の判定に使う。
export function latestSelfKinds(history) {
  const map = new Map();
  for (const h of history || []) {
    if (!h || !h.selfKind || !h.questionId) continue;
    const prev = map.get(h.questionId);
    if (!prev || h.at > prev.at) map.set(h.questionId, { selfKind: h.selfKind, at: h.at, objectiveCorrect: h.objectiveCorrect });
  }
  return map;
}

// 渡された問題プールのうち、直近の自己採点が「○完璧」だったものだけを返す（素のリスト）。
export function maruQuestions(pool, history) {
  const latest = latestSelfKinds(history);
  return (pool || []).filter((q) => latest.get(q.id)?.selfKind === 'maru');
}

// ○プールに付加情報を付けて返す（#1・#4・#5・#6・#9・#10の共通基盤）。
//   uncertain: 選んだ選択肢は客観的に不正解なのに○を通した「うっかり○」（QuestionCardの確認を経て強行したもの）
//   mastered : SRSで5連続○（マスター）済みか
export function maruStatusList(pool, history, srs = {}) {
  const latest = latestSelfKinds(history);
  const out = [];
  for (const q of pool || []) {
    const entry = latest.get(q.id);
    if (!entry || entry.selfKind !== 'maru') continue;
    out.push({
      question: q,
      at: entry.at,
      uncertain: entry.objectiveCorrect === false,
      mastered: isMastered(srs[q.id]),
    });
  }
  return out;
}

// #5：マスター済み（5連続○）を除いた、まだ検証が浅い○だけに絞る。
export function excludeMastered(list) {
  return (list || []).filter((s) => !s.mastered);
}

// #1・#4：うっかり○を先頭に、そのあとは○にしてから時間が経っている順
//   （しばらく見直していないものを優先。見直す優先度づけ）。
export function orderMaruStatus(list) {
  return [...(list || [])].sort((a, b) => {
    if (a.uncertain !== b.uncertain) return a.uncertain ? -1 : 1;
    return a.at - b.at;
  });
}

// #6：科目ごとの○の内訳。マスター済みの割合が高い科目＝得意科目、として使う
//   （Analytics.jsxの得意科目分析・Home.jsx/ExamDayChecklist.jsxのメッセージで共用）。
export function maruSubjectBreakdown(list) {
  const bySubject = new Map();
  for (const s of list || []) {
    const key = s.question.subject || 'その他';
    if (!bySubject.has(key)) bySubject.set(key, { subject: key, total: 0, mastered: 0, uncertain: 0 });
    const row = bySubject.get(key);
    row.total += 1;
    if (s.mastered) row.mastered += 1;
    if (s.uncertain) row.uncertain += 1;
  }
  return [...bySubject.values()]
    .map((r) => ({ ...r, masteredPct: r.total > 0 ? r.mastered / r.total : 0 }))
    .sort((a, b) => b.masteredPct - a.masteredPct || b.total - a.total);
}
