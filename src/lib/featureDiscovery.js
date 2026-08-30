// 「まだ使ったことのない機能」の提案（#改善・2026-08-28追加）。
// 60超の機能が下部ナビ6画面＋常設バー＋各画面内メニューに散らばっており、
// FeatureIndex.jsx の検索は「探せば見つかる」が「気づかれない」問題は解決しない。
// Home画面で毎回1件だけ、まだ開いたことのない機能を提示する。
//
// 対象は featureRegistry.js の「単独の画面」（sub: true でないもの）のみ。
// sub: true の項目は既存画面の中の一機能なので、view単位の訪問記録とは噛み合わない。

// 日替わりで安定した1件を選ぶ（同じ日の間はHomeを何度再描画しても同じ提案のまま）。
// 乱数ではなく日付ベースにすることで、選ばれなかった候補を明日また試せる。
function dayIndex(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const diff = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start;
  return Math.floor(diff / 86400000);
}

export function suggestUnvisitedFeature(featureRegistry, visitedViews, date = new Date()) {
  const visited = new Set(visitedViews || []);
  const candidates = featureRegistry.filter((f) => !f.sub && f.view !== 'home' && !visited.has(f.view));
  if (candidates.length === 0) return null;
  const idx = dayIndex(date) % candidates.length;
  return candidates[idx];
}
