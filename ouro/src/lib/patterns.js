// 投稿の「型」——伸びた投稿を、次の投稿の種にする。
//
// 量産だけでは伸びない。効くのは
//   ①型を決めて何本か出す → ②実際の数字を見る → ③**伸びた型だけ**を次の種にする
// という回し方で、これを繰り返すとアカウントの中身が一つに寄っていく（統一感）。
// 寄るほど「その話が読みたい人」だけが残るので、売るものと噛み合う。
//
// 決まりごと：
//  ・**型は自分の実測から作る。** 最初だけ手で見本を入れ、あとは伸びた投稿から作る。
//  ・**1本伸びただけで結論にしない**（`MIN_POSTS`）。たまたまを型にすると、
//    次の20本まるごとハズレになる。
//  ・**勝ち型を勝手に入れ替えない。** 提案するだけで、決めるのは人
//    （掲示板の棚卸しと同じ考え方）。
//  ・AIを呼ばない。

import { newId } from './id.js';

export const PATTERN_ORIGINS = {
  seed: '手で入れた見本',
  own: '自分の伸びた投稿',
};

/** 型は持ちすぎない。多いほど「どれが効いたか」が薄まる。 */
export const MAX_PATTERNS = 12;

/** この本数に届くまでは順位を付けない（たまたまを結論にしないため）。 */
export const MIN_POSTS = 3;

export function makePattern(data = {}) {
  const now = Date.now();
  return {
    id: data.id || newId('pat'),
    ventureId: data.ventureId || null,
    // 型の本文（伸びた投稿そのもの、または見本）
    text: String(data.text || '').trim().slice(0, 1200),
    origin: PATTERN_ORIGINS[data.origin] ? data.origin : 'seed',
    // 自分の投稿から作った時だけ、元の投稿を覚えておく（片方向）
    postId: data.postId || null,
    label: String(data.label || '').slice(0, 40),
    note: String(data.note || '').slice(0, 200),
    // 休止：消さずに外す（消すと、その型で出した投稿の記録が迷子になる）
    archivedAt: data.archivedAt || null,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

export function addPattern(patterns = [], pattern) {
  if (!pattern || !pattern.id || !pattern.text) return patterns;
  return [pattern, ...patterns.filter((p) => p.id !== pattern.id)].slice(0, MAX_PATTERNS * 4);
}

export function updatePattern(patterns = [], id, patch = {}) {
  return patterns.map((p) => (p.id === id ? { ...p, ...patch, id: p.id, updatedAt: Date.now() } : p));
}

export function removePattern(patterns = [], id) {
  return patterns.filter((p) => p.id !== id);
}

/** 使う型（休止を除く）。事業でしぼれる。 */
export function patternsOf(patterns = [], ventureId = null) {
  return patterns
    .filter((p) => !p.archivedAt)
    .filter((p) => (ventureId ? p.ventureId === ventureId : true))
    .slice(0, MAX_PATTERNS);
}

/**
 * その型で出した投稿の実測。
 * **投稿の側の `patternId` から数える**（型に一覧を持たせない。
 * 持たせると誰も更新しない列になる、というのを案件で1度やっている）。
 */
export function patternStats(pattern, posts = []) {
  const mine = posts.filter((p) => p.patternId === pattern.id);
  const sum = (k) => mine.reduce((n, p) => n + (Number(p[k]) || 0), 0);
  const count = mine.length;
  const reaction = sum('reaction');
  return {
    count,
    reach: sum('reach'),
    reaction,
    lead: sum('lead'),
    // 1投稿あたりの反応。本数が違う型どうしを並べるにはこれで見る。
    perPost: count ? Number((reaction / count).toFixed(1)) : 0,
    // まだ結論を出せる本数ではない
    tooFew: count < MIN_POSTS,
  };
}

/**
 * 型の順位。**本数が足りない型には順位を付けない。**
 * @returns {{pattern, stats, rank}[]} rank は 1 から。足りない型は null。
 */
export function rankPatterns(patterns = [], posts = []) {
  const rows = patterns.map((pattern) => ({ pattern, stats: patternStats(pattern, posts) }));
  // **数字が入っていない型に順位を付けない。**
  // 本数だけ揃っても反応が0なら、効いたかどうかは分かっていない
  // （「1位」と出ると、効いた型だと誤解する）。
  const enough = rows
    .filter((r) => !r.stats.tooFew && r.stats.perPost > 0)
    .sort((a, b) => b.stats.perPost - a.stats.perPost);
  const rankOf = new Map(enough.map((r, i) => [r.pattern.id, i + 1]));
  return rows
    .map((r) => ({ ...r, rank: rankOf.get(r.pattern.id) || null }))
    .sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.rank) return -1;
      if (b.rank) return 1;
      return b.stats.count - a.stats.count;
    });
}

/**
 * いちばん効いている型（順位が付いたものの中の1位）。無ければ null。
 * **反応が0のものを「効いている」と言わない**（本数だけ揃っても中身が無い）。
 */
export function bestPattern(patterns = [], posts = []) {
  const top = rankPatterns(patterns, posts).find((r) => r.rank === 1 && r.stats.perPost > 0);
  return top ? top.pattern : null;
}

/**
 * 「これを型にしませんか」の候補。
 *
 * 型になっていない投稿のうち、**その事業の平均よりはっきり伸びたもの**。
 * 平均の何倍か、で見る（手元にない基準は使わない）。
 */
export const WINNER_RATIO = 1.5;

export function winnerCandidates(posts = [], patterns = [], { limit = 3 } = {}) {
  const withNumbers = posts.filter((p) => (Number(p.reaction) || 0) > 0);
  if (withNumbers.length < MIN_POSTS) return [];
  const avg = withNumbers.reduce((n, p) => n + (Number(p.reaction) || 0), 0) / withNumbers.length;
  const already = new Set(patterns.map((p) => p.postId).filter(Boolean));
  return withNumbers
    .filter((p) => !already.has(p.id))
    .filter((p) => p.text && p.text.trim())
    .filter((p) => (Number(p.reaction) || 0) >= avg * WINNER_RATIO)
    .sort((a, b) => (b.reaction || 0) - (a.reaction || 0))
    .slice(0, limit)
    .map((p) => ({ post: p, times: Number(((p.reaction || 0) / avg).toFixed(1)), avg: Math.round(avg) }));
}

/**
 * 候補が出せる状態か。**出せない時に黙らない**——
 * 数字を入れたのに何も起きないと、壊れているのか足りないのか分からない。
 */
export function candidateStatus(posts = []) {
  const withNumbers = posts.filter((p) => (Number(p.reaction) || 0) > 0);
  if (withNumbers.length >= MIN_POSTS) {
    const avg = withNumbers.reduce((n, p) => n + (Number(p.reaction) || 0), 0) / withNumbers.length;
    return { ready: true, measured: withNumbers.length, need: 0, avg: Math.round(avg) };
  }
  return { ready: false, measured: withNumbers.length, need: MIN_POSTS - withNumbers.length, avg: 0 };
}

/** 型から次の種を作る（人が押した時だけ）。 */
export function patternFromPost(post, ventureId = null) {
  return makePattern({
    ventureId: ventureId || post.ventureId || null,
    text: post.text || post.title || '',
    origin: 'own',
    postId: post.id,
    label: (post.title || '').slice(0, 40),
  });
}
