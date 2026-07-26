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

// ---- 攻略率・合格ライン診断・合格者スタイル診断 ----

const DAY_MS_L = 24 * 60 * 60 * 1000;

// 直近 n 問の正答率（少なければある分だけ）。合格ライン予測の土台。
export function recentAccuracy(history, n = 120) {
  if (!history.length) return null;
  const recent = history.slice(-n);
  const correct = recent.filter((h) => h.correct).length;
  return correct / recent.length;
}

// 学習した「異なる日」の数と、今日（または昨日）から連続している日数
export function studyStreak(history) {
  if (!history.length) return { activeDays: 0, streak: 0 };
  const days = new Set();
  history.forEach((h) => {
    if (!h.at) return;
    const d = new Date(h.at);
    d.setHours(0, 0, 0, 0);
    days.add(d.getTime());
  });
  const sorted = [...days].sort((a, b) => b - a);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = today.getTime();
  // 今日か昨日から途切れずに続いている日数を数える
  let streak = 0;
  let cursor = t;
  if (!days.has(t) && days.has(t - DAY_MS_L)) cursor = t - DAY_MS_L;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS_L;
  }
  return { activeDays: sorted.length, streak };
}

// 正答率の推移（直近を等間隔のブロックに割り、各ブロックの正答率）
export function accuracyTrend(history, blocks = 8) {
  if (history.length < 2) return [];
  const size = Math.max(10, Math.ceil(history.length / blocks));
  const out = [];
  for (let i = 0; i < history.length; i += size) {
    const chunk = history.slice(i, i + size);
    if (chunk.length < Math.min(5, size)) continue;
    const correct = chunk.filter((h) => h.correct).length;
    out.push({ n: chunk.length, accuracy: correct / chunk.length });
  }
  return out.slice(-blocks);
}

// 合格ライン診断（㉑）: 直近の正答率を「予想得点率」とし、合格ライン(既定60%)との差を返す
export function passReadiness(history, passLine = 0.6) {
  const predicted = recentAccuracy(history, 150);
  if (predicted == null) {
    return { predicted: null, passLine, gap: null, reached: false, progress: 0, sample: 0 };
  }
  const sample = Math.min(history.length, 150);
  const gap = passLine - predicted; // 正なら「あと gap」、負なら到達（余裕）
  return {
    predicted,
    passLine,
    gap,
    reached: predicted >= passLine,
    progress: Math.min(1, predicted / passLine),
    sample,
  };
}

// 問題ごとの学習ステータスを SRS から判定
//  untouched:未着手 / review:要復習 / learning:学習中 / mastered:定着
export function questionStatus(state, isInReviewFn, matureInterval) {
  if (!state || (state.seen || 0) === 0) return 'untouched';
  if (isInReviewFn(state)) return 'review';
  const interval = state.interval || 0;
  const reps = state.reps || 0;
  if (interval >= matureInterval || reps >= 3) return 'mastered';
  return 'learning';
}

// 攻略率・カバー率（⑱）。examCoverage は scopeCoverage の戻り値、srs と判定関数を渡す。
// 戻り値: 全体サマリ + 科目別（攻略率＝定着/収録, カバー率＝着手/収録）
export function masteryStats(questions, srs, isInReviewFn, matureInterval, scopeList) {
  const total = questions.length;
  const buckets = { untouched: 0, review: 0, learning: 0, mastered: 0 };
  questions.forEach((q) => {
    const st = questionStatus(srs[q.id], isInReviewFn, matureInterval);
    buckets[st] += 1;
  });
  const attempted = total - buckets.untouched;
  const overall = {
    total,
    ...buckets,
    coverage: total > 0 ? attempted / total : 0, // 着手率
    mastery: total > 0 ? buckets.mastered / total : 0, // 攻略率
  };

  const bySubject = (scopeList || []).map((c) => {
    // c: { subject, count, ... } — 収録ある科目だけ攻略率を出す
    const ids = c.ids || [];
    let mastered = 0;
    let attemptedS = 0;
    ids.forEach((qid) => {
      const st = questionStatus(srs[qid], isInReviewFn, matureInterval);
      if (st !== 'untouched') attemptedS += 1;
      if (st === 'mastered') mastered += 1;
    });
    return {
      name: c.subject.name,
      count: c.count,
      mastered,
      attempted: attemptedS,
      coverage: c.count > 0 ? attemptedS / c.count : 0,
      mastery: c.count > 0 ? mastered / c.count : 0,
    };
  });

  return { overall, bySubject };
}

// 合格者スタイル診断（㉒）: 学習パターンをルールで分類し、型・強み・助言を返す
export function styleDiagnosis(history, questions, srs, isInReviewFn, matureInterval) {
  const total = history.length;
  if (total < 20) {
    return {
      ready: false,
      type: 'これから型',
      emoji: '🌱',
      summary: '診断にはもう少しデータが必要です。まずは合計20問、数日にわたって解いてみましょう。',
      metrics: [],
      strengths: [],
      advice: ['1日10分でもいいので、続けて解答データをためましょう。'],
    };
  }

  const { activeDays, streak } = studyStreak(history);
  const acc = overallStats(history).accuracy || 0;
  const recent = recentAccuracy(history, 100) || acc;
  const perActiveDay = activeDays > 0 ? total / activeDays : total;

  // 学習の分散度（何日にわたって解いたか）
  const firstAt = history[0]?.at || Date.now();
  const spanDays = Math.max(1, Math.round((Date.now() - firstAt) / DAY_MS_L) + 1);
  const regularity = activeDays / spanDays; // 1に近いほど毎日

  // 科目の広さ
  const subjSet = new Set(history.map((h) => h.subject).filter(Boolean));
  const breadth = subjSet.size;

  // 復習の活用度（定着済みの割合）
  let mastered = 0;
  let touched = 0;
  questions.forEach((q) => {
    const st = questionStatus(srs[q.id], isInReviewFn, matureInterval);
    if (st !== 'untouched') touched += 1;
    if (st === 'mastered') mastered += 1;
  });
  const masteryRate = touched > 0 ? mastered / touched : 0;

  const metrics = [
    { label: '継続', value: `${streak}日連続 / 実績${activeDays}日` },
    { label: '演習量', value: `のべ${total}問（1日あたり約${Math.round(perActiveDay)}問）` },
    { label: '直近の正答率', value: formatPercent(recent) },
    { label: '科目の広さ', value: `${breadth}科目` },
    { label: '定着率', value: formatPercent(masteryRate) },
  ];

  // ---- 型の判定（優先度順）----
  let type, emoji, summary;
  const strengths = [];
  const advice = [];

  if (regularity >= 0.6 && streak >= 4) {
    type = 'コツコツ継続型';
    emoji = '📅';
    summary = '毎日少しずつ積み上げるのが得意。合格者にいちばん多い王道スタイルです。';
    strengths.push('学習が習慣になっている（継続力が高い）');
  } else if (perActiveDay >= 40 && activeDays <= 6) {
    type = '追い込み集中型';
    emoji = '🔥';
    summary = '短期間に一気に量をこなすタイプ。爆発力がある反面、間隔があくと忘れやすいので復習設計が鍵。';
    strengths.push('一度に大量にこなす集中力');
    advice.push('翌日と1週間後に「間違えた問題」で復習し、詰め込みを定着に変えましょう。');
  } else if (masteryRate >= 0.5 && touched >= 40) {
    type = '弱点克服型';
    emoji = '🎯';
    summary = '解いた問題をしっかり定着させるのが上手。取りこぼしの少ない堅実タイプです。';
    strengths.push('復習で確実に定着させている（定着率が高い）');
  } else if (breadth >= 8) {
    type = '全科目バランス型';
    emoji = '⚖️';
    summary = '幅広い科目に手をつけられている。得点の穴を作りにくい安定タイプです。';
    strengths.push('多くの科目をまんべんなくカバー');
  } else {
    type = '成長スタート型';
    emoji = '🚀';
    summary = '学習が動き出したところ。ここから習慣とカバー範囲を広げれば一気に伸びます。';
  }

  // 共通の強み・助言
  if (recent >= 0.6) strengths.push(`直近の正答率が合格ライン超え（${formatPercent(recent)}）`);
  if (breadth >= 6) strengths.push(`${breadth}科目に取り組めている`);

  if (recent < 0.6) advice.push('直近の正答率が合格ライン(60%)未満。「間違えた問題」で弱点を優先的に潰しましょう。');
  if (regularity < 0.4) advice.push('学習日にムラがあります。毎日の学習を短くても続けると定着が安定します。');
  if (breadth < 6) advice.push('取り組んだ科目が偏りぎみ。試験範囲画面で未着手の科目にも触れてみましょう。');
  if (masteryRate < 0.3 && touched >= 20)
    advice.push('解きっぱなしになりがち。同じ問題を数日おきに解き直すと「定着」に変わります。');
  if (!advice.length) advice.push('この調子で継続を。900問モードで一周し、模試で仕上げましょう。');

  return { ready: true, type, emoji, summary, metrics, strengths, advice };
}
