// 合格体験記の下書き自動生成（任意・遊び要素）。
// これまでの学習ログから、あとで清書する用の体験記のたたき台を作る。
// 結果はまだ分からない前提の下書きなので、断定せず「書き足してください」で促す。

import { overallStats, studyStreak } from './stats.js';

export function buildExperienceDraft({ history = [], examResults = [], level = null } = {}) {
  const overall = overallStats(history);
  const { longestStreak, activeDays } = studyStreak(history);
  const bestExam = examResults
    .filter((r) => !r.mode || r.mode === 'am' || r.mode === 'pm')
    .reduce((best, r) => (best == null || r.scorePct > best.scorePct ? r : best), null);

  const lines = [];
  lines.push('※このアプリでの学習記録から自動で下書きを作りました。結果や気持ちに合わせて自由に書き直してください。');
  lines.push('');
  lines.push(
    `このアプリで解いた問題は延べ${overall.total}問、通算正答率は${
      overall.accuracy != null ? Math.round(overall.accuracy * 100) + '%' : '—'
    }でした。`
  );
  if (activeDays > 0) {
    lines.push(`学習した日数は延べ${activeDays}日、最長の連続学習記録は${longestStreak}日でした。`);
  }
  if (bestExam) {
    lines.push(`模擬試験のベストスコアは${bestExam.scorePct}%（${bestExam.modeLabel || '模試'}）でした。`);
  }
  if (level) {
    lines.push(`直近の自己評価レベルは「${level.label}」でした。`);
  }
  lines.push('');
  lines.push('【学習を振り返って】');
  lines.push('（続けられた理由・つらかった時期・工夫したことなどを書き足してください）');
  lines.push('');
  lines.push('【これから受験する人へ】');
  lines.push('（後輩へのアドバイスを書き足してください）');
  return lines.join('\n');
}
