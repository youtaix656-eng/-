// 出題順の組み立てロジック（Session.jsx・Quiz.jsxで共用）。
//   新規・復習の混合や、原問と派生を離す並べ替えなど、
//   「今何を何問出すか」を決める純粋関数だけを集約する。

import { reviewPoolFor } from './reviewPool.js';
import { buildCaseLinkMap, keepCasePairsAdjacent } from './casePairs.js';

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 原問と派生（同じ過去問由来）を離す。id末尾の枝記号を除いた基幹idでバケット分割し、
//   ラウンドロビンで並べて同一由来が隣り合わないようにする。
const baseId = (id) => String(id).replace(/[a-z]+$/i, '');
export function spaceById(ids) {
  if (ids.length < 3) return ids;
  const buckets = new Map();
  for (const id of ids) { const b = baseId(id); if (!buckets.has(b)) buckets.set(b, []); buckets.get(b).push(id); }
  if (buckets.size < 2) return ids;
  const lists = shuffle([...buckets.values()]);
  const out = [];
  let more = true;
  while (more) {
    more = false;
    for (const l of lists) { if (l.length) { out.push(l.shift()); more = true; } }
  }
  return out;
}

// pool を繰り返して target 長の出題順（id 配列）を作る
export function buildOrder(pool, target) {
  if (pool.length === 0) return [];
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  let ids = [];
  while (ids.length < target) ids = ids.concat(shuffle(pool).map((q) => q.id));
  return keepCasePairsAdjacent(spaceById(ids.slice(0, target)), linkOf, pairOf);
}
// 「すべて新規」用：未着手（未解答）の問題だけを出題順にする。
//   過去に解いた問題は混ぜず、繰り返しもしない（残り新規が尽きたらそこで終了）。
export function buildNewOnlyOrder(pool, target, srs) {
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  const newPool = pool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0);
  return keepCasePairsAdjacent(spaceById(shuffle(newPool).map((q) => q.id).slice(0, target)), linkOf, pairOf);
}
// 「すべて復習」用：復習対象プールだけを出題順にする（繰り返さない・足りなければそこで終了）。
export function buildReviewOnlyOrder(pool, target, srs) {
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  const reviewPool = reviewPoolFor(pool, srs);
  return keepCasePairsAdjacent(spaceById(shuffle(reviewPool).map((q) => q.id).slice(0, target)), linkOf, pairOf);
}
// 指定プールを「新規◯割・復習◯割」で混ぜて target 長の出題順を作る（周回あり＝繰り返して埋める）。
// newRatio: 0〜1（1=すべて新規）。新規＝未着手、復習＝復習対象。
export function buildMixedOrder(pool, target, newRatio, srs) {
  if (pool.length === 0) return [];
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  const newPool = pool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0);
  const reviewPool = reviewPoolFor(pool, srs);
  const fill = (base, count) => {
    if (count <= 0) return [];
    const src = base.length ? base : pool;
    let ids = [];
    while (ids.length < count) ids = ids.concat(shuffle(src).map((q) => q.id));
    return ids.slice(0, count);
  };
  const newCount = Math.round(target * Math.min(1, Math.max(0, newRatio)));
  const reviewCount = target - newCount;
  const combined = [...fill(newPool, newCount), ...fill(reviewPool, reviewCount)];
  return keepCasePairsAdjacent(spaceById(shuffle(combined).slice(0, target)), linkOf, pairOf);
}
// 指定プールを「新規◯割・復習◯割」で混ぜる（周回なし＝繰り返さず、該当分だけで終わる）。
export function buildMixedNoRepeatOrder(pool, target, newRatio, srs) {
  if (pool.length === 0) return [];
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  const newPool = pool.filter((q) => !srs[q.id] || (srs[q.id].seen || 0) === 0);
  const reviewPool = reviewPoolFor(pool, srs);
  const newCount = Math.round(target * Math.min(1, Math.max(0, newRatio)));
  const reviewCount = target - newCount;
  const takeNew = shuffle(newPool).map((q) => q.id).slice(0, newCount);
  const takeReview = shuffle(reviewPool).map((q) => q.id).slice(0, reviewCount);
  return keepCasePairsAdjacent(spaceById(shuffle([...takeNew, ...takeReview])), linkOf, pairOf);
}
