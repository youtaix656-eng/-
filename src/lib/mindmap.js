// マインドマップ用のロジック（純粋関数）。
//   センターのキーワードに対して：
//     - つながる語（連結学習：同じ問題に一緒に付いたキーワード＝共起）
//     - 比較されやすいもの（KB）
//     - 数値を変えられやすいもの（KB）
//   をまとめ、放射状レイアウトの座標も返す。

import { effectiveTags } from './query.js';
import { comparisonsForKeyword, numbersForKeyword, suggestedCenters } from '../data/mindmapData.js';

// 共起：センター語と同じ問題に付いている他のキーワード（多い順）
export function linkedKeywords(center, questions, links) {
  const co = new Map();
  for (const q of questions) {
    const tags = new Set(effectiveTags(q, links));
    if (!tags.has(center)) continue;
    for (const t of tags) if (t !== center) co.set(t, (co.get(t) || 0) + 1);
  }
  return [...co.entries()].sort((a, b) => b[1] - a[1]).map(([k, w]) => ({ keyword: k, weight: w }));
}

// センターのマインドマップ内容
export function mindmapFor(center, questions, links) {
  return {
    center,
    linked: linkedKeywords(center, questions, links),
    comparisons: comparisonsForKeyword(center),
    numbers: numbersForKeyword(center),
  };
}

// センター候補：ユーザーが付けたキーワード ∪ おすすめトピック
export function centerCandidates(questions, links) {
  const set = new Set();
  for (const q of questions) for (const t of effectiveTags(q, links)) set.add(t);
  const user = [...set];
  const suggested = suggestedCenters().filter((s) => !set.has(s));
  return { user, suggested };
}

// 放射状レイアウト。ブランチをタイプ別に角度配分（100x100座標系）。
//   type: 'linked' | 'compare' | 'number'
export function radialLayout(branches, cx = 50, cy = 50, R = 38) {
  const n = branches.length || 1;
  return branches.map((b, i) => {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { ...b, x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });
}

// マインドマップの全ブランチ（表示用に種類をまとめる）
export function branchesOf(mm, opts = {}) {
  const maxLinked = opts.maxLinked || 8;
  const branches = [];
  mm.linked.slice(0, maxLinked).forEach((l) => branches.push({ id: l.keyword, label: l.keyword, type: 'linked' }));
  mm.comparisons.forEach((c) => branches.push({ id: c.id, label: c.title, type: 'compare' }));
  mm.numbers.forEach((num) => branches.push({ id: num.id, label: `${num.topic}＝${num.value}`, type: 'number' }));
  return branches;
}
