// 「今日集中すべき科目」自動レコメンド。
// 残り日数×科目別の手薄度（収録数の少なさ）×直近正答率から、今日重点的に取り組むと良い
// 科目を提案する。CoverageMap.jsx/pastExamTrends.jsxは「見て気づく」設計だが、こちらは
// 「今日これ」まで踏み込んだレコメンドが目的。目安であり厳密な最適化ではない。

import { subjectPriority } from './pastExamTrends.js';

const THIN_COUNT = 20; // これ未満は「手薄」とみなす（CoverageMap.jsxと同じ基準）
const FREQ_WEIGHT = 0.25; // 頻出度（過去問で繰り返し出るテーマの多さ）の重み。固定（残り日数に関わらず一定）。

// scope: examScope.jsのscopeCoverage()の戻り値
//   [{ subject: {id,name,...}, count, ids, answered, correct, accuracy }]
// daysLeft: 試験日までの残り日数（null可、未設定時は中間値として扱う）
// questions: 渡すと過去問の頻出度（pastExamTrends.jsのsubjectPriority）も加味する（省略可・後方互換）。
//   正答率・手薄さだけでは「実は過去問で繰り返し出ている科目」が埋もれてしまうため。
export function todayFocusSubjects(scope, daysLeft, { limit = 3, questions = null } = {}) {
  const t = daysLeft == null ? 0.5 : Math.max(0, Math.min(1, daysLeft / 180));
  const accuracyWeight = 1 - t * 0.4; // 0.6〜1.0（試験が近いほど正答率の低さを重視）
  const thinnessWeight = t * 0.4; // 0〜0.4（試験まで時間がある時ほど手薄さも考慮）

  const freqBySubject = questions
    ? new Map(subjectPriority(questions, { limit: 9999 }).map((p) => [p.subject, p.repeatedGenreCount]))
    : new Map();
  const maxFreq = Math.max(1, ...freqBySubject.values());

  return (scope || [])
    .filter((s) => s.count > 0) // 収録がない科目は演習しようがないので対象外
    .map((s) => {
      const accuracyGap = s.accuracy == null ? 0.5 : 1 - s.accuracy; // 未着手は中間の危険度扱い
      const thinness = Math.max(0, Math.min(1, (THIN_COUNT - s.count) / THIN_COUNT));
      const freqScore = (freqBySubject.get(s.subject.name) || 0) / maxFreq;
      const score = accuracyGap * accuracyWeight + thinness * thinnessWeight + freqScore * FREQ_WEIGHT;
      let reason;
      if (s.answered === 0) reason = 'まだ手つかず';
      else if (freqScore > 0 && freqScore >= accuracyGap && freqScore >= thinness) reason = '過去問での頻出テーマが多い';
      else if (accuracyGap >= thinness) reason = `正答率${Math.round((s.accuracy ?? 0) * 100)}%`;
      else reason = `収録${s.count}問と手薄`;
      return { subject: s.subject, count: s.count, answered: s.answered, accuracy: s.accuracy, score, reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
