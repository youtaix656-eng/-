// 復習・要注意（リーチ）の「滞留」を可視化する（#9・#10・#11・#23）。
//   srs.js は wrongCount／correctStreak の"今の値"しか持たないため、
//   「いつからその状態か」は history（解答履歴）を辿って求める。

import { LEECH_THRESHOLD, MASTER_STREAK, isLeech, isInReview } from './srs.js';
import { latestMissType } from './missTypes.js';

// 指定の問題が、誤答回数がLEECH_THRESHOLDに達した瞬間（＝要注意になった瞬間）のatを返す。
//   history上で追跡できない（それ以前からの持ち越しデータ等）場合はnull。
export function leechSince(questionId, history) {
  let wrongCount = 0;
  for (const h of history) {
    if (h.questionId !== questionId || h.correct) continue;
    wrongCount += 1;
    if (wrongCount === LEECH_THRESHOLD) return h.at;
  }
  return null;
}

export function leechDwellDays(questionId, history, now = Date.now()) {
  const since = leechSince(questionId, history);
  if (since == null) return null;
  return Math.floor((now - since) / (24 * 60 * 60 * 1000));
}

// 要注意問題を滞留日数の長い順に並べる（#9のバッジ・#7/#8のHomeカードで共用）。
export function leechList(questions, srs, history, now = Date.now()) {
  return questions
    .filter((q) => isLeech(srs[q.id]))
    .map((q) => ({ question: q, dwellDays: leechDwellDays(q.id, history, now) }))
    .sort((a, b) => (b.dwellDays || 0) - (a.dwellDays || 0));
}

// 要注意の科目別内訳（#11）。
export function leechBySubject(questions, srs) {
  const counts = {};
  for (const q of questions) {
    if (!isLeech(srs[q.id])) continue;
    const s = q.subject || 'その他';
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);
}

// この問題が最初に間違えた（＝復習対象に入った）時刻。
export function firstWrongAt(questionId, history) {
  for (const h of history) {
    if (h.questionId === questionId && !h.correct) return h.at;
  }
  return null;
}

// 現在まだ復習対象（isInReview）である問題の、科目別の平均滞留日数（#23）。
//   「いつ解消したか」は追跡していないため、対象は未解消のものだけ
//   （＝今どれだけ引っかかっているか、を見るための指標）。
export function reviewDwellBySubject(questions, srs, history, now = Date.now()) {
  const bySubject = {};
  for (const q of questions) {
    if (!isInReview(srs[q.id])) continue;
    const since = firstWrongAt(q.id, history);
    if (since == null) continue;
    const days = (now - since) / (24 * 60 * 60 * 1000);
    const s = q.subject || 'その他';
    if (!bySubject[s]) bySubject[s] = { sum: 0, count: 0 };
    bySubject[s].sum += days;
    bySubject[s].count += 1;
  }
  return Object.entries(bySubject)
    .map(([subject, v]) => ({ subject, avgDays: Math.round(v.sum / v.count), count: v.count }))
    .sort((a, b) => b.avgDays - a.avgDays);
}

// 要注意になったあと、5連続○でマスターに達した（＝要注意を解消した）瞬間のイベント一覧（#10）。
//   correctness だけを辿る簡易シミュレーション（srs.jsの間隔計算とは無関係。streak/wrongCountの
//   カウントだけを再現する）。
export function resolvedLeechEvents(history) {
  const byQuestion = new Map();
  for (const h of history || []) {
    if (!byQuestion.has(h.questionId)) byQuestion.set(h.questionId, []);
    byQuestion.get(h.questionId).push(h);
  }
  const events = [];
  for (const [questionId, list] of byQuestion) {
    let wrongCount = 0;
    let streak = 0;
    let isCurrentlyLeech = false;
    for (const h of list) {
      if (h.correct) {
        streak += 1;
        if (isCurrentlyLeech && streak >= MASTER_STREAK) {
          events.push({ questionId, at: h.at });
          isCurrentlyLeech = false; // 解消後、再度リーチ化するまでは重複計上しない
        }
      } else {
        wrongCount += 1;
        streak = 0;
        if (wrongCount >= LEECH_THRESHOLD) isCurrentlyLeech = true;
      }
    }
  }
  return events;
}

export function resolvedLeechesSince(history, sinceMs) {
  return resolvedLeechEvents(history).filter((e) => e.at >= sinceMs).length;
}

// 現在まだ復習対象（isInReview）である問題の、直近の誤答理由（型）別の平均滞留日数。
//   reviewDwellBySubjectの「科目別」を「型別」に変えたもの（型の記録が無い問題は対象外）。
export function reviewDwellByMissType(questions, srs, history, missTypes, now = Date.now()) {
  const byType = {};
  for (const q of questions) {
    if (!isInReview(srs[q.id])) continue;
    const type = latestMissType(missTypes?.[q.id])?.type;
    if (!type) continue;
    const since = firstWrongAt(q.id, history);
    if (since == null) continue;
    const days = (now - since) / (24 * 60 * 60 * 1000);
    if (!byType[type]) byType[type] = { sum: 0, count: 0 };
    byType[type].sum += days;
    byType[type].count += 1;
  }
  return Object.entries(byType)
    .map(([type, v]) => ({ type, avgDays: Math.round(v.sum / v.count), count: v.count }))
    .sort((a, b) => b.avgDays - a.avgDays);
}
