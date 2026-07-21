// 音声学習 × 連結学習法の再生プランを組み立てるための純粋関数群。
//
// - キーワード（連結キーワード / タグ）ごとの問題クラスタ
// - キーワード同士の関連（同じ問題に一緒に付いている＝共起）
// - 関連をたどる「連鎖」順
// - 解答履歴からキーワード別の正答率（弱点順）
//
// 実際の読み上げ文はコンポーネント側で組み立てる（ここはデータのみ）。

import { effectiveTags } from './query.js';
import { hashStr } from './connect.js';

// キーワード → 問題配列
export function clustersMap(questions, links) {
  const map = new Map();
  for (const q of questions) {
    for (const kw of new Set(effectiveTags(q, links))) {
      if (!map.has(kw)) map.set(kw, []);
      map.get(kw).push(q);
    }
  }
  return map;
}

// 関連問題が多い順のキーワード一覧
export function allKeywords(questions, links) {
  const m = clustersMap(questions, links);
  return [...m.entries()]
    .map(([keyword, qs]) => ({ keyword, questions: qs, count: qs.length }))
    .sort((a, b) => b.count - a.count || String(a.keyword).localeCompare(String(b.keyword), 'ja'));
}

// キーワードの共起（同じ問題に一緒に付いている回数）→ 関連キーワード順
export function relatedKeywordMap(questions, links) {
  const co = new Map();
  const bump = (a, b) => {
    if (!co.has(a)) co.set(a, new Map());
    co.get(a).set(b, (co.get(a).get(b) || 0) + 1);
  };
  for (const q of questions) {
    const tags = [...new Set(effectiveTags(q, links))];
    for (let i = 0; i < tags.length; i++) {
      for (let j = 0; j < tags.length; j++) {
        if (i !== j) bump(tags[i], tags[j]);
      }
    }
  }
  const out = new Map();
  for (const [kw, m] of co) {
    out.set(kw, [...m.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]));
  }
  return out;
}

// start から関連をたどってキーワードを並べる（芋づる式）。
// 関連が尽きたら残りを末尾に足す。
export function chainOrder(start, relatedMap, allKwList) {
  const known = new Set(allKwList);
  const order = [];
  const visited = new Set();
  if (known.has(start)) {
    order.push(start);
    visited.add(start);
  }
  let frontier = [...order];
  while (frontier.length) {
    const next = [];
    for (const kw of frontier) {
      for (const r of relatedMap.get(kw) || []) {
        if (!visited.has(r) && known.has(r)) {
          visited.add(r);
          order.push(r);
          next.push(r);
        }
      }
    }
    frontier = next;
  }
  for (const kw of allKwList) {
    if (!visited.has(kw)) {
      visited.add(kw);
      order.push(kw);
    }
  }
  return order;
}

// キーワード別の正答率（弱点＝低い順）。未回答は中間(0.5)扱いで後ろ寄りに。
export function keywordAccuracy(questions, links, history) {
  const byQ = new Map();
  for (const h of history || []) {
    const r = byQ.get(h.questionId) || { c: 0, t: 0 };
    r.t += 1;
    if (h.correct) r.c += 1;
    byQ.set(h.questionId, r);
  }
  const clusters = clustersMap(questions, links);
  const res = [];
  for (const [keyword, qs] of clusters) {
    let c = 0;
    let t = 0;
    for (const q of qs) {
      const r = byQ.get(q.id);
      if (r) {
        c += r.c;
        t += r.t;
      }
    }
    res.push({ keyword, questions: qs, answered: t, accuracy: t ? c / t : null });
  }
  return res.sort((a, b) => {
    const aa = a.accuracy == null ? 0.5 : a.accuracy;
    const ab = b.accuracy == null ? 0.5 : b.accuracy;
    if (aa !== ab) return aa - ab; // 正答率が低い＝弱点を先に
    return b.questions.length - a.questions.length;
  });
}

// 「今日の連結」用：日替わりでキーワードの開始点を1つ選ぶ（同じ日は同じ）
export function dailyKeyword(questions, links, key) {
  const kws = allKeywords(questions, links);
  if (kws.length === 0) return null;
  return kws[hashStr(key) % kws.length].keyword;
}
