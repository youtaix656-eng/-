// 試験日カウントダウン・達成バッジ（習慣化の後押し）
import { overallStats, studyStreak, questionStatus } from './stats.js';

// 試験日までの残り日数（今日を含めず）。無効な日付は null。
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function formatExamDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// 達成バッジ一覧を算出。earned=獲得済み、progress={cur,goal}。
export function computeBadges(history, srs, questions, examResults, isInReviewFn, matureInterval) {
  const total = history.length;
  const { streak } = studyStreak(history);
  const acc = overallStats(history).accuracy || 0;

  let mastered = 0;
  questions.forEach((q) => {
    if (questionStatus(srs[q.id], isInReviewFn, matureInterval) === 'mastered') mastered += 1;
  });
  const subjectsStudied = new Set(history.map((h) => h.subject).filter(Boolean)).size;
  const passedExam = (examResults || []).some((r) => r.passed);
  const examCount = (examResults || []).length;

  const mk = (id, icon, title, desc, cur, goal) => ({
    id, icon, title, desc,
    earned: cur >= goal,
    progress: { cur: Math.min(cur, goal), goal },
  });

  return [
    mk('streak3', '🔥', '継続3日', '3日連続で学習', streak, 3),
    mk('streak7', '🔥', '継続7日', '7日連続で学習', streak, 7),
    mk('streak30', '🏅', '継続30日', '30日連続で学習', streak, 30),
    mk('q100', '📚', '100問', 'のべ100問を解答', total, 100),
    mk('q500', '📚', '500問', 'のべ500問を解答', total, 500),
    mk('q1000', '🎓', '1000問', 'のべ1000問を解答', total, 1000),
    mk('subj5', '🗺️', '5科目', '5科目に取り組む', subjectsStudied, 5),
    mk('subj13', '🌏', '全13科目', '全科目に取り組む', subjectsStudied, 13),
    mk('master50', '💪', '定着50', '50問を定着させる', mastered, 50),
    mk('master150', '👑', '定着150', '150問を定着させる', mastered, 150),
    mk('acc70', '🎯', '正答率70%', '通算正答率70%以上', Math.round(acc * 100), 70),
    mk('exam1', '📝', '模試デビュー', '模試を1回受ける', examCount, 1),
    mk('examPass', '✨', '合格ライン到達', '模試で合格ライン(60%)到達', passedExam ? 1 : 0, 1),
  ];
}
