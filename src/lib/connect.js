// 連結学習法（つなげて覚える）ロジック
//
// - 1日1問の「深掘り」問題を日替わりで決定（同じ日は同じ問題）
// - 連続学習日数（ストリーク）の計算
//
// 「知識の地図」は、問題に付けたキーワードと、問題どうしのリンクから
// クラスタを組み立てて可視化する（ConnectedLearning.jsx 側）。

// ローカル日付の YYYY-MM-DD キー
export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 文字列 → 安定した非負整数ハッシュ
export function hashStr(s) {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// 日付キーで決定的に1問を選ぶ（同じ日・同じ母集団なら常に同じ問題）
export function dailyPick(pool, key) {
  if (!pool || pool.length === 0) return null;
  return pool[hashStr(key) % pool.length];
}

// 前日の日付キー
export function prevDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return dateKey(dt);
}

// ストリーク更新：今日深掘りした結果の新しい連続日数を返す
//  - 同じ日に2回目 → 変化なし
//  - 前日に続けての実施 → +1
//  - それ以外（間が空いた/初回） → 1
export function nextStreak(prevDate, prevStreak, today = dateKey()) {
  if (!prevDate) return 1;
  if (prevDate === today) return prevStreak || 1;
  if (prevDate === prevDateKey(today)) return (prevStreak || 0) + 1;
  return 1;
}

// キーワード → 問題ID群 のインデックスを作る（連結マップ用）
export function keywordClusters(questions, links) {
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const map = {};
  Object.entries(links).forEach(([qid, link]) => {
    if (!byId[qid]) return;
    (link.keywords || []).forEach((kw) => {
      const key = String(kw).trim();
      if (!key) return;
      (map[key] = map[key] || []).push(qid);
    });
  });
  // クラスタを「つながりの強い順（問題数が多い順）」に
  return Object.entries(map)
    .map(([keyword, ids]) => ({ keyword, questionIds: Array.from(new Set(ids)) }))
    .sort((a, b) => b.questionIds.length - a.questionIds.length);
}

// 明示的な「関連問題」リンク（双方向に正規化）
export function relatedPairs(questions, links) {
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const seen = new Set();
  const pairs = [];
  Object.entries(links).forEach(([qid, link]) => {
    (link.related || []).forEach((rid) => {
      if (!byId[qid] || !byId[rid] || qid === rid) return;
      const key = [qid, rid].sort().join('::');
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push([qid, rid]);
    });
  });
  return pairs;
}
