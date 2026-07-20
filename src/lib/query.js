// 出題ビルダー・検索のための絞り込みロジック
//
// 問題の科目・回次（第何回）・ジャンル（タグ）・ファイル（デッキ）や、
// 「間違えた問題」「タグ付けした問題」などの状態でフィルタし、出題プールを作る。
//
// タグは問題自身の tags と、連結学習で付けたキーワード（links）の両方を合わせて扱う。

import { isInReview } from './srs.js';

function uniqSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
    String(a).localeCompare(String(b), 'ja')
  );
}

export function allSubjects(questions) {
  return uniqSorted(questions.map((q) => q.subject));
}

export function allRounds(questions) {
  return uniqSorted(questions.map((q) => q.round));
}

export function allDecks(questions) {
  return uniqSorted(questions.map((q) => q.deck));
}

// 問題の実効タグ（問題自身のtags ∪ 連結キーワード）
export function effectiveTags(q, links) {
  const own = q.tags || [];
  const kw = (links && links[q.id] && links[q.id].keywords) || [];
  return Array.from(new Set([...own, ...kw]));
}

export function allTags(questions, links) {
  const all = [];
  questions.forEach((q) => all.push(...effectiveTags(q, links)));
  return uniqSorted(all);
}

// 条件で問題を絞り込む
// opts: { subjects[], rounds[], tags[], decks[], onlyWrong, onlyTagged, srs, links }
export function filterQuestions(questions, opts = {}) {
  const {
    subjects = [],
    rounds = [],
    tags = [],
    decks = [],
    onlyWrong = false,
    onlyTagged = false,
    srs = {},
    links = {},
  } = opts;

  return questions.filter((q) => {
    if (subjects.length && !subjects.includes(q.subject)) return false;
    if (rounds.length && !rounds.includes(q.round)) return false;
    if (decks.length && !decks.includes(q.deck)) return false;
    if (tags.length) {
      const et = effectiveTags(q, links);
      if (!tags.some((t) => et.includes(t))) return false;
    }
    if (onlyWrong && !isInReview(srs[q.id])) return false;
    if (onlyTagged && effectiveTags(q, links).length === 0) return false;
    return true;
  });
}

// キーワード検索（問題文・選択肢・科目・回・タグを対象）
export function searchQuestions(questions, term, links) {
  const t = String(term || '').trim().toLowerCase();
  if (!t) return [];
  return questions.filter((q) => {
    const hay = [
      q.question,
      q.subject,
      q.round,
      ...(q.choices || []),
      q.explanation,
      ...effectiveTags(q, links),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(t);
  });
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// プールから出題順を作る。count 指定があればその数だけ、なければ全部。
// random=true でシャッフル。
export function buildOrder(pool, { count = 0, random = true } = {}) {
  let list = random ? shuffle(pool) : [...pool];
  if (count && count > 0) list = list.slice(0, count);
  return list;
}
