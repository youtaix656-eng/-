// 項目難易度推定（#8）— 自分の解答履歴から各問の難しさを較正する純粋関数。
//   難易度＝誤答率（試行回数が少ない問はベイズ的に全体平均へ寄せて安定化）。
//   history: [{ questionId, subject, correct, at }]

// 問題ごとの試行・誤答を集計
export function attemptsByQuestion(history = []) {
  const m = new Map();
  for (const h of history) {
    const cur = m.get(h.questionId) || { attempts: 0, wrong: 0 };
    cur.attempts += 1;
    if (!h.correct) cur.wrong += 1;
    m.set(h.questionId, cur);
  }
  return m;
}

// 全体の誤答率（事前分布の平均に使う）
function globalWrongRate(history) {
  if (!history.length) return 0.5;
  const wrong = history.reduce((s, h) => s + (h.correct ? 0 : 1), 0);
  return wrong / history.length;
}

// 各問の難易度（0=易しい〜1=難しい）。prior 件の擬似観測で平滑化。
export function itemDifficulty(history = [], { prior = 2 } = {}) {
  const base = globalWrongRate(history);
  const agg = attemptsByQuestion(history);
  const out = new Map();
  for (const [id, { attempts, wrong }] of agg) {
    const diff = (wrong + prior * base) / (attempts + prior);
    out.set(id, { attempts, wrong, difficulty: diff });
  }
  return out;
}

// 難しい順の問題（最低試行回数でフィルタ）。[{ id, question, difficulty, attempts, wrong }]
export function hardestItems(history, questions, { minAttempts = 2, limit = 20 } = {}) {
  const diff = itemDifficulty(history);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const rows = [];
  for (const [id, d] of diff) {
    if (d.attempts < minAttempts) continue;
    const q = byId.get(id);
    if (!q) continue;
    rows.push({ id, question: q, ...d });
  }
  rows.sort((a, b) => b.difficulty - a.difficulty || b.attempts - a.attempts);
  return limit > 0 ? rows.slice(0, limit) : rows;
}
