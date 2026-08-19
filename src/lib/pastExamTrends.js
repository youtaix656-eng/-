// 鍼灸過去問題の傾向分析 — 「感覚」ではなく、収録済みの過去問データ（round・tags・genre）を
// 実際に集計して頻出テーマ・頻出キーワードを導く。Home.jsx の「鍼灸過去問題の傾向と対策」から使う。
//
// 過去問1問ごとに「原問×1＋一問一答×4」で教材化する方針上、原問（round が設定されている問題）
// だけを集計対象にする。一問一答の派生問題は round を持たないため、実際の出題回数を
// 水増ししない（＝「同じ過去問から4問作った」ことと「4回出題された」ことを混同しない）。

import { effectiveTags } from './query.js';
import { roundKey } from './round.js';

export function pastExamQuestions(questions) {
  return questions.filter((q) => q.round != null);
}

// 収録概況：総数・対象科目数・対象になっている回の一覧（新しい順）
export function overview(questions) {
  const past = pastExamQuestions(questions);
  const subjects = new Set(past.map((q) => q.subject).filter(Boolean));
  const rounds = Array.from(new Set(past.map((q) => roundKey(q.round)).filter(Boolean))).sort(
    (a, b) => Number(b) - Number(a)
  );
  return { total: past.length, subjectCount: subjects.size, rounds };
}

// 科目別の収録数
export function subjectBreakdown(questions) {
  const past = pastExamQuestions(questions);
  const map = new Map();
  for (const q of past) {
    const s = q.subject || 'その他';
    if (!map.has(s)) map.set(s, 0);
    map.set(s, map.get(s) + 1);
  }
  return Array.from(map.entries())
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);
}

// 頻出ジャンル（大項目｜中項目）：同じジャンルが複数の回にわたって出題されているほど
// 「頻出テーマ」として優先度が高いとみなす（roundsフィールドで実際の出題回を確認できる）。
export function genreFrequency(questions, { limit = 15, subject = null } = {}) {
  const past = pastExamQuestions(questions).filter((q) => !subject || q.subject === subject);
  const map = new Map(); // key: subject|genre -> { subject, genre, count, rounds:Set, questionIds:[] }
  for (const q of past) {
    if (!q.genre) continue;
    const key = `${q.subject}|${q.genre}`;
    if (!map.has(key)) map.set(key, { subject: q.subject, genre: q.genre, count: 0, rounds: new Set(), questionIds: [] });
    const entry = map.get(key);
    entry.count += 1;
    const rk = roundKey(q.round);
    if (rk) entry.rounds.add(rk);
    entry.questionIds.push(q.id);
  }
  return Array.from(map.values())
    .map((e) => ({
      subject: e.subject,
      genre: e.genre,
      count: e.count,
      roundCount: e.rounds.size,
      rounds: Array.from(e.rounds).sort((a, b) => Number(b) - Number(a)),
      questionIds: e.questionIds,
    }))
    .sort((a, b) => b.roundCount - a.roundCount || b.count - a.count)
    .slice(0, limit);
}

// 頻出キーワード（tags∪連結キーワード）：複数の回にまたがって登場するタグほど優先度が高い。
export function tagFrequency(questions, links, { limit = 20, subject = null } = {}) {
  const past = pastExamQuestions(questions).filter((q) => !subject || q.subject === subject);
  const map = new Map(); // tag -> { tag, count, rounds:Set, questionIds:[] }
  for (const q of past) {
    const rk = roundKey(q.round);
    for (const tag of effectiveTags(q, links)) {
      if (!map.has(tag)) map.set(tag, { tag, count: 0, rounds: new Set(), questionIds: [] });
      const entry = map.get(tag);
      entry.count += 1;
      if (rk) entry.rounds.add(rk);
      entry.questionIds.push(q.id);
    }
  }
  return Array.from(map.values())
    .map((e) => ({ tag: e.tag, count: e.count, roundCount: e.rounds.size, rounds: Array.from(e.rounds).sort((a, b) => Number(b) - Number(a)), questionIds: e.questionIds }))
    .sort((a, b) => b.roundCount - a.roundCount || b.count - a.count)
    .slice(0, limit);
}

// 科目ごとの「頻出度スコア」：頻出ジャンル上位の合計出題回数を科目別に集計し、
// どの科目が特に「繰り返し同じテーマが出る＝対策の費用対効果が高い」かを見る目安にする。
export function subjectPriority(questions, { limit = 8 } = {}) {
  const genres = genreFrequency(questions, { limit: 9999 });
  const map = new Map();
  for (const g of genres) {
    if (g.roundCount < 2) continue; // 複数回出ているテーマのみを「頻出」とみなす
    if (!map.has(g.subject)) map.set(g.subject, { subject: g.subject, repeatedGenreCount: 0, topGenres: [] });
    const entry = map.get(g.subject);
    entry.repeatedGenreCount += 1;
    if (entry.topGenres.length < 3) entry.topGenres.push(g.genre);
  }
  return Array.from(map.values())
    .sort((a, b) => b.repeatedGenreCount - a.repeatedGenreCount)
    .slice(0, limit);
}
