// 弱点クラスタリング（#7）— 間違いのタグ共起から弱いテーマを抽出する純粋関数。
//   誤答した問題のタグを集計し、「誤答が多い／誤答率が高いタグ」を弱点テーマとして返す。
//   history: [{ questionId, subject, correct, at }] / questions: タグ付き問題配列

import { effectiveTags } from './query.js';

// タグ別の {attempts, wrong} を集計
function tagStats(history, questions, links) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const stats = new Map();
  for (const h of history) {
    const q = byId.get(h.questionId);
    if (!q) continue;
    for (const tag of effectiveTags(q, links)) {
      const cur = stats.get(tag) || { attempts: 0, wrong: 0 };
      cur.attempts += 1;
      if (!h.correct) cur.wrong += 1;
      stats.set(tag, cur);
    }
  }
  return stats;
}

// 弱点タグのランキング。[{ tag, attempts, wrong, rate }]
//   minWrong 以上の誤答があるタグを、誤答数→誤答率の順で返す。
export function weakTagClusters(history = [], questions = [], links = {}, { minWrong = 1, limit = 12 } = {}) {
  const stats = tagStats(history, questions, links);
  const rows = [];
  for (const [tag, { attempts, wrong }] of stats) {
    if (wrong < minWrong) continue;
    rows.push({ tag, attempts, wrong, rate: attempts ? wrong / attempts : 0 });
  }
  rows.sort((a, b) => b.wrong - a.wrong || b.rate - a.rate);
  return limit > 0 ? rows.slice(0, limit) : rows;
}

// 弱点タグに紐づく問題を集める（復習の出題プール作成に使える）
export function questionsForWeakTags(weakTags, questions, links, { limit = 0 } = {}) {
  const want = new Set(weakTags.map((w) => (typeof w === 'string' ? w : w.tag)));
  const out = questions.filter((q) => effectiveTags(q, links).some((t) => want.has(t)));
  return limit > 0 ? out.slice(0, limit) : out;
}
