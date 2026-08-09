// 用語集の自動生成＋逆引き（#14）— タグ（正式名称）ごとに解説から短い定義を集める。
//   問題演習の副産物として用語→定義の逆引き学習を作る純粋関数。

import { effectiveTags } from './query.js';

// 解説文の先頭一文を定義サンプルとして抜き出す
function firstSentence(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  const m = s.match(/^[^。]*。/);
  return (m ? m[0] : s).slice(0, 80);
}

// 用語集を生成。[{ term, count, subjects[], sample, questionIds[] }]（収録数の多い順）
export function buildGlossary(questions = [], links = {}, { minCount = 1, limit = 0 } = {}) {
  const map = new Map();
  for (const q of questions) {
    for (const term of effectiveTags(q, links)) {
      if (!map.has(term)) map.set(term, { term, count: 0, subjects: new Set(), sample: '', questionIds: [] });
      const e = map.get(term);
      e.count += 1;
      if (q.subject) e.subjects.add(q.subject);
      e.questionIds.push(q.id);
      if (!e.sample && q.explanation) e.sample = firstSentence(q.explanation);
    }
  }
  const rows = [...map.values()]
    .filter((e) => e.count >= minCount)
    .map((e) => ({ ...e, subjects: [...e.subjects] }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term, 'ja'));
  return limit > 0 ? rows.slice(0, limit) : rows;
}

// 逆引き：語で用語集を検索（部分一致）
export function lookupGlossary(glossary, term) {
  const t = String(term || '').trim();
  if (!t) return [];
  return glossary.filter((g) => g.term.includes(t));
}
