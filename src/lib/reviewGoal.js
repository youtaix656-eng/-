// 「今日の復習」目標の計算（#15）。以前はReview.jsxだけが持っていたロジックを
//   Home.jsxからも同じ数字で表示できるよう切り出した（単一の正）。
//   日次目標＝今日こなした復習＋まだ期限が来ている数（今日中に片づけたい総量）。
//   「今日の調子＝しんどい」の日はノルマを半分に緩める（Homeの今日の調子と連動）。

export function todayReviewDoneOf(history, now = Date.now()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  const start0 = d.getTime();
  return (history || []).filter((h) => h.source === 'review' && h.at >= start0).length;
}

export function reviewDailyGoal(history, dueCount, mood, now = Date.now()) {
  const todayReviewDone = todayReviewDoneOf(history, now);
  const goalDueBase = mood === 'tired' ? Math.ceil(dueCount * 0.5) : dueCount;
  const dailyGoal = Math.max(1, todayReviewDone + goalDueBase);
  const goalPct = Math.min(100, Math.round((todayReviewDone / dailyGoal) * 100));
  return { todayReviewDone, dailyGoal, goalPct };
}
