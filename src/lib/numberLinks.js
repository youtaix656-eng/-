// 数値の串刺し（#6）— 同じ数字が出てくる知識を分野をまたいで束ねる。
//   NUMBER_FACTS の value から数値トークンを取り出し、一致するもの同士をつなぐ。

// value から代表となる数値トークン（複数可）を取り出す
export function numberTokens(value) {
  const m = String(value || '').match(/\d+(?:\.\d+)?/g);
  return m ? [...new Set(m)] : [];
}

// 同じ数字を含む facts を束ねる。[{ num, facts:[...] }]（分野が2つ以上またぐものを優先）
export function numberSkewers(facts, { minGroup = 2 } = {}) {
  const groups = new Map();
  for (const f of facts) {
    for (const num of numberTokens(f.value)) {
      if (!groups.has(num)) groups.set(num, []);
      groups.get(num).push(f);
    }
  }
  const out = [];
  for (const [num, list] of groups) {
    // 同じ topic の重複を除く
    const uniq = [];
    const seen = new Set();
    for (const f of list) { if (!seen.has(f.id)) { seen.add(f.id); uniq.push(f); } }
    if (uniq.length < minGroup) continue;
    const subjects = new Set(uniq.map((f) => f.subject));
    out.push({ num, facts: uniq, crossSubject: subjects.size >= 2 });
  }
  // 分野をまたぐ束を優先、その中でサイズ順
  out.sort((a, b) => (b.crossSubject - a.crossSubject) || (b.facts.length - a.facts.length));
  return out;
}
