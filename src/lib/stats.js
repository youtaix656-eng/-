// 弱点分析用の集計ロジック

// 科目一覧を問題データから抽出（出現順）
export function getSubjects(questions) {
  const seen = new Set();
  const list = [];
  questions.forEach((q) => {
    if (!seen.has(q.subject)) {
      seen.add(q.subject);
      list.push(q.subject);
    }
  });
  return list;
}

// 解答履歴から科目別の正答率を集計
// 戻り値: [{ subject, total, correct, accuracy }] 正答率の低い順（苦手順）
export function subjectStats(history, questions) {
  const subjects = getSubjects(questions);
  const map = {};
  subjects.forEach((s) => (map[s] = { subject: s, total: 0, correct: 0 }));

  history.forEach((h) => {
    if (!map[h.subject]) map[h.subject] = { subject: h.subject, total: 0, correct: 0 };
    map[h.subject].total += 1;
    if (h.correct) map[h.subject].correct += 1;
  });

  return Object.values(map)
    .map((m) => ({
      ...m,
      accuracy: m.total > 0 ? m.correct / m.total : null,
    }))
    .sort((a, b) => {
      // 未解答（accuracy null）は末尾へ、それ以外は正答率の低い順
      if (a.accuracy == null && b.accuracy == null) return 0;
      if (a.accuracy == null) return 1;
      if (b.accuracy == null) return -1;
      return a.accuracy - b.accuracy;
    });
}

// 全体の統計
export function overallStats(history) {
  const total = history.length;
  const correct = history.filter((h) => h.correct).length;
  return {
    total,
    correct,
    accuracy: total > 0 ? correct / total : null,
  };
}

// 直近 n 日間の学習量（日別の解答数）
export function dailyActivity(history, days = 14) {
  const now = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    buckets.push({ date: d, count: 0, correct: 0 });
  }
  const startMs = buckets[0].date.getTime();
  history.forEach((h) => {
    if (h.at < startMs) return;
    const d = new Date(h.at);
    d.setHours(0, 0, 0, 0);
    const b = buckets.find((x) => x.date.getTime() === d.getTime());
    if (b) {
      b.count += 1;
      if (h.correct) b.correct += 1;
    }
  });
  return buckets;
}

export function formatPercent(v) {
  if (v == null) return '—';
  return Math.round(v * 100) + '%';
}
