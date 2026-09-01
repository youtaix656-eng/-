// 「○（完璧）」にした問題のプール。
//   自己採点で最後に○を選んだ問題だけを対象にし、次の2つの使い道に使う：
//   ①問題演習で見直す（本当に理解していて○にしたか、適当に○にしていないかの確認）
//   ②高速回転でインプット強化（もう分かっている内容を素早く回して記憶を固める）
// あとで△・✕に変わっていれば、最新の記録がそちらになるので自動的にこのプールから外れる。

// questionId → 最新の自己採点（selfKindが付いた履歴のみ。gradeMode等selfKindの無い記録は無視）。
export function latestSelfKinds(history) {
  const map = new Map();
  for (const h of history || []) {
    if (!h || !h.selfKind || !h.questionId) continue;
    const prev = map.get(h.questionId);
    if (!prev || h.at > prev.at) map.set(h.questionId, { selfKind: h.selfKind, at: h.at });
  }
  return map;
}

// 渡された問題プールのうち、直近の自己採点が「○完璧」だったものだけを返す。
export function maruQuestions(pool, history) {
  const latest = latestSelfKinds(history);
  return (pool || []).filter((q) => latest.get(q.id)?.selfKind === 'maru');
}
