// 復習プール・弱点分析の共通ロジック（Session.jsx・AudioMode.jsx で共用）。
//   画面ごとに「復習」の定義がズレないよう、この1ファイルを正とする。

import { isInReview, isDue } from './srs.js';
import { forgettingRisk } from './forgetting.js';
import { effectiveTags } from './query.js';

// 忘却リスクのしきい値（InsightsSection.jsx の忘却予測と同じ）・「念のため確認」の混入上限。
export const FORGETTING_THRESHOLD = 0.4;
export const SAFETY_CHECK_MIN = 3;
export const SAFETY_CHECK_RATIO = 0.15;

// 復習対象プール：復習期限が来ている問題を優先し、無ければ復習対象全体にフォールバック
//   （lib/useStore.js の dueReviewQuestions と同じ優先順位）。
//   加えて、一度も間違えていない（isInReviewの対象外）が保持率が下がってきた問題を
//   「念のため確認」として少数混ぜる。自信満々の○だけで一度も復習に出ないまま
//   忘れるのを防ぐため。
export function reviewPoolFor(pool, srs) {
  const inReview = pool.filter((q) => isInReview(srs[q.id]));
  const due = inReview.filter((q) => isDue(srs[q.id]));
  const base = due.length > 0 ? due : inReview;
  const inReviewIds = new Set(inReview.map((q) => q.id));
  const atRisk = forgettingRisk(pool, srs, { threshold: FORGETTING_THRESHOLD })
    .map((r) => r.question)
    .filter((q) => !inReviewIds.has(q.id));
  if (atRisk.length === 0) return base;
  const cap = base.length > 0 ? Math.max(SAFETY_CHECK_MIN, Math.round(base.length * SAFETY_CHECK_RATIO)) : Math.min(atRisk.length, 20);
  return [...base, ...atRisk.slice(0, cap)];
}

// 誤答・あいまい（△✕）の問題群から、弱点を文章と関連対比で示す材料を作る。
//   実際に出た誤答のジャンル・キーワードの頻度だけを根拠にする（憶測での説明は行わない）。
export function buildWeaknessSummary(wrongQs, links, comparisons) {
  if (wrongQs.length < 3) return null;
  const tagCount = {};
  for (const q of wrongQs) {
    for (const tg of effectiveTags(q, links)) tagCount[tg] = (tagCount[tg] || 0) + 1;
  }
  const topTags = Object.entries(tagCount)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const genreCount = {};
  for (const q of wrongQs) {
    const g = q.genre || q.subject || 'その他';
    genreCount[g] = (genreCount[g] || 0) + 1;
  }
  const topGenres = Object.entries(genreCount)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topTags.length === 0 && topGenres.length === 0) return null;
  const tagSet = new Set(Object.keys(tagCount));
  const relatedComparisons = (comparisons || []).filter((c) => (c.terms || []).some((t) => tagSet.has(t))).slice(0, 3);
  return { topTags, topGenres, relatedComparisons };
}

// 弱点分析を読み上げ用の短い文章に変換する。
export function weaknessSummaryToText(summary) {
  if (!summary) return '';
  const parts = [];
  if (summary.topGenres.length > 0) {
    parts.push(`${summary.topGenres.map(([g]) => g).join('、')}で、誤答やあいまいが目立ちました。`);
  }
  if (summary.topTags.length > 0) {
    parts.push(`繰り返しつまずいたキーワードは、${summary.topTags.map(([tg]) => tg).join('、')}です。`);
  }
  return `弱点分析。${parts.join(' ')}`;
}

// 「今日のおすすめ」：復習の溜まり具合から新規◯割を自動で決める（迷ったときの初期値提案）。
//   stalledDays（#17）：復習が何日ゼロに戻せていないか（reviewZeroLog.jsのdaysSinceLastZero）。
//   3日以上溜まったまま戻せていない時は、通常の比率よりさらに復習へ寄せる。
export function recommendNewPct(newRemaining, reviewRemaining, stalledDays = 0) {
  if (reviewRemaining === 0) return { pct: 100, reason: '復習対象が無いので、すべて新規にしました。' };
  if (newRemaining === 0) return { pct: 0, reason: '新規問題が無いので、すべて復習にしました。' };
  if (stalledDays >= 3) {
    if (reviewRemaining >= 10) {
      return { pct: 10, reason: `復習が${stalledDays}日ゼロに戻せていないので、今日は復習を最優先にしました。` };
    }
    return { pct: 30, reason: `復習が${stalledDays}日ゼロに戻せていないので、復習多めにしました。` };
  }
  if (reviewRemaining >= 30) return { pct: 30, reason: `復習対象が${reviewRemaining}問溜まっているので、復習多めにしました。` };
  if (reviewRemaining >= 10) return { pct: 50, reason: `復習対象が${reviewRemaining}問あるので、半々にしました。` };
  return { pct: 70, reason: `復習対象は${reviewRemaining}問だけなので、新規多めにしました。` };
}
