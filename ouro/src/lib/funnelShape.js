// 収益導線の「入れ物の形」だけを置く、小さなファイル。
//
// `useStore` は起動のいちばん最初に `makeFunnel()`（EMPTY と読み込みの受け皿）と
// `normalizeFunnel()`（読み込んだ値の整え）を**同期で**使う。けれど `funnel.js` は
// 4段の定義・週の集計・詰まっている段の判定まで持つファイルで、
// **収益導線の画面は lazy なのに、この2つの import だけで起動時の束へ入っていた**。
// `eventItem.js`（schedule.js から）・`notes.js`（memory.js から）と同じ形の切り出し。
//
// funnel.js からも再輸出しているので、画面側の import は変えなくてよい。

export function makeFunnel() {
  return {
    // 段の表示名だけ上書きできる（数と順番は変えない）
    labels: {},
    // 週ごとの数字
    entries: [],
    updatedAt: 0,
  };
}

export function normalizeFunnel(funnel) {
  const base = makeFunnel();
  if (!funnel || typeof funnel !== 'object') return base;
  return {
    ...base,
    ...funnel,
    labels: funnel.labels && typeof funnel.labels === 'object' ? funnel.labels : {},
    entries: Array.isArray(funnel.entries) ? funnel.entries.filter((e) => e && e.id) : [],
  };
}
