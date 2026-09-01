// 新しく追加した問題群の正答率が極端（全問正解・全問不正解）に振れていないかの点検（#21）。
//   「新規追加」はcontentSeedLog.jsのログが持つid一覧から判定する（追加日時が分かっているのは
//   ここだけなので、他の手段で「新しさ」を推測しない）。個人の学習履歴だけを見るため、
//   母数が少ないうちの判定は当てにならない＝minAttempts未満は対象外にする。

export function extremeAccuracyAlerts(seedLog, history, { minAttempts = 5, sinceMs = 0 } = {}) {
  const byQuestion = new Map();
  for (const h of history || []) {
    if (!h.questionId) continue;
    const cur = byQuestion.get(h.questionId) || { attempts: 0, correct: 0 };
    cur.attempts += 1;
    if (h.correct) cur.correct += 1;
    byQuestion.set(h.questionId, cur);
  }

  const results = [];
  for (const entry of seedLog || []) {
    if (entry.at < sinceMs) continue;
    const bySubjectStats = new Map(); // subject -> { attempts, correct, ids }
    for (const id of entry.ids || []) {
      const st = byQuestion.get(id);
      if (!st || st.attempts < 1) continue;
      // idからは科目が分からないため、bySubjectの内訳（同じ順で積んだもの）に頼らず
      // 単純に全体で集計する（このログの粒度＝バッチ単位で十分）。
      if (!bySubjectStats.has('_all')) bySubjectStats.set('_all', { attempts: 0, correct: 0, ids: [] });
      const agg = bySubjectStats.get('_all');
      agg.attempts += st.attempts;
      agg.correct += st.correct;
      agg.ids.push(id);
    }
    const agg = bySubjectStats.get('_all');
    if (!agg || agg.attempts < minAttempts) continue;
    const accuracy = agg.correct / agg.attempts;
    if (accuracy === 0 || accuracy === 1) {
      results.push({ at: entry.at, bySubject: entry.bySubject, accuracy, attempts: agg.attempts, questionCount: agg.ids.length });
    }
  }
  return results;
}
