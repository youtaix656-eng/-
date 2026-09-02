// 弱点クラスタリング（#7）— 間違いのタグ共起から弱いテーマを抽出する純粋関数。
//   誤答した問題のタグを集計し、「誤答が多い／誤答率が高いタグ」を弱点テーマとして返す。
//   history: [{ questionId, subject, correct, at }] / questions: タグ付き問題配列

import { effectiveTags } from './query.js';
import { canonical, isGenericTag } from './synonyms.js';

// タグ別の {attempts, wrong} を集計（表記ゆれは正式名称へ正規化＝改善4）
function tagStats(history, questions, links) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const stats = new Map();
  for (const h of history) {
    const q = byId.get(h.questionId);
    if (!q) continue;
    const seen = new Set();
    for (const raw of effectiveTags(q, links)) {
      const tag = canonical(raw);
      if (seen.has(tag)) continue; // 同一問題内で正規化後に重複したら1回だけ
      seen.add(tag);
      const cur = stats.get(tag) || { attempts: 0, wrong: 0 };
      cur.attempts += 1;
      if (!h.correct) cur.wrong += 1;
      stats.set(tag, cur);
    }
  }
  return stats;
}

// 全問題での各タグの出現数（df）。汎用すぎるタグ（多くの問題に付く）を除くのに使う。
function tagDocFreq(questions, links) {
  const df = new Map();
  for (const q of questions) {
    const seen = new Set();
    for (const raw of effectiveTags(q, links)) {
      const tag = canonical(raw);
      if (seen.has(tag)) continue;
      seen.add(tag);
      df.set(tag, (df.get(tag) || 0) + 1);
    }
  }
  return df;
}

// 弱点タグのランキング。[{ tag, attempts, wrong, rate }]
//   ・表記ゆれを正規化して統合、汎用タグ（GENERIC_TAGS）を除外
//   ・データが十分あるときは「多くの問題に付く汎用タグ」も除外（狙い撃ち精度UP）
export function weakTagClusters(history = [], questions = [], links = {}, { minWrong = 1, limit = 12 } = {}) {
  const stats = tagStats(history, questions, links);
  const df = tagDocFreq(questions, links);
  const genericCut = questions.length >= 12 ? Math.max(8, questions.length * 0.5) : Infinity;
  const rows = [];
  for (const [tag, { attempts, wrong }] of stats) {
    if (wrong < minWrong) continue;
    if (!tag || tag.length <= 1) continue;
    if (isGenericTag(tag)) continue; // 汎用語は除外
    if ((df.get(tag) || 0) >= genericCut) continue; // 出現しすぎる汎用タグは除外
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

// タグ別の「今週 vs 先週」誤答率トレンド（#25）。以前はReview.jsxだけが持っていた
//   インライン計算を切り出したもの（単一の正。WeeklyJournal.jsxでも同じ関数を使う）。
//   tags: 文字列配列 or weakTagClusters()の結果（{tag}を持つオブジェクト配列）どちらでも可。
export function tagTrend(history, questions, links, tags, { windowMs = 7 * 24 * 60 * 60 * 1000, now = Date.now() } = {}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const thisWeek = {};
  const lastWeek = {};
  for (const h of history) {
    const q = byId.get(h.questionId);
    if (!q) continue;
    const age = now - h.at;
    const bucket = age <= windowMs ? thisWeek : age <= 2 * windowMs ? lastWeek : null;
    if (!bucket) continue;
    for (const tg of effectiveTags(q, links)) {
      if (!bucket[tg]) bucket[tg] = { wrong: 0, total: 0 };
      bucket[tg].total += 1;
      if (!h.correct) bucket[tg].wrong += 1;
    }
  }
  return tags.map((w) => {
    const tag = typeof w === 'string' ? w : w.tag;
    const cur = thisWeek[tag];
    const prev = lastWeek[tag];
    const curRate = cur && cur.total >= 2 ? cur.wrong / cur.total : null;
    const prevRate = prev && prev.total >= 2 ? prev.wrong / prev.total : null;
    let trend = null;
    if (curRate != null && prevRate != null) {
      const diff = curRate - prevRate;
      trend = diff <= -0.15 ? 'better' : diff >= 0.15 ? 'worse' : 'flat';
    }
    const base = typeof w === 'string' ? { tag } : w;
    return { ...base, curRate, prevRate, trend };
  });
}
