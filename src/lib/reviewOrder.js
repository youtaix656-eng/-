// 復習の並べ替え・絞り込みロジック（#1 忘却リスク順 / #5 難問優先 / #8 検索・並べ替え / #4 弱点絞り込み）。
//   Review 画面から使う純粋関数。UI を持たないのでテストできる。

import { effectiveTags } from './query.js';
import { retrievability } from './forgetting.js';
import { itemDifficulty } from './difficulty.js';
import { normalize } from './srs.js';
import { expandQuery } from './synonyms.js';
import { isSameRound } from './round.js';

// 忘却リスク（0〜1、高いほど忘れそう）。間隔未確定（間違えた直後など）は最優先=1。
export function riskOf(q, srs, now = Date.now()) {
  const r = retrievability(srs[q.id], now);
  return r == null ? 1 : 1 - r;
}

// 検索一致（キーワード：問題文・科目・タグ・解説。同義語も展開して拾う）
export function matchesSearch(q, term, links) {
  const raw = String(term || '').trim();
  if (!raw) return true;
  // 同義語展開は辞書のキー（大文字表記など）を保つため生の語で行い、比較時に小文字化する
  const words = new Set([raw.toLowerCase(), ...expandQuery(raw).map((w) => w.toLowerCase())]);
  const hay = [q.question, q.subject, q.explanation, ...(q.choices || []), ...effectiveTags(q, links)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  for (const w of words) if (w && hay.includes(w)) return true;
  return false;
}

// 復習リストを絞り込み（科目（複数可）＋弱点タグ＋検索語＋回＋ブックマーク＋忘却リスク／誤答回数の下限＋誤答理由の型）
export function filterReview(
  questions,
  {
    subject = '',
    subjects = [],
    tag = '',
    term = '',
    links = {},
    round = '',
    bookmarkOnly = false,
    bookmarks = {},
    minRisk = 0,
    minWrong = 0,
    srs = {},
    now = Date.now(),
    missType = '',
    missTypes = {},
  } = {}
) {
  return questions.filter((q) => {
    if (subject && q.subject !== subject) return false;
    if (subjects.length > 0 && !subjects.includes(q.subject)) return false;
    if (tag && !effectiveTags(q, links).includes(tag)) return false;
    if (term && !matchesSearch(q, term, links)) return false;
    if (round && !isSameRound(q.round, round)) return false;
    if (bookmarkOnly && !bookmarks[q.id]) return false;
    if (minWrong > 0 && (normalize(srs[q.id]).wrongCount || 0) < minWrong) return false;
    if (minRisk > 0 && Math.round(riskOf(q, srs, now) * 100) < minRisk) return false;
    if (missType && missTypes[q.id]?.type !== missType) return false;
    return true;
  });
}

// 並べ替え／出題順。mode: 'due'|'forget'|'hard'|'wrong'|'subject'
//   history は難易度（誤答率）推定に使う。
export function sortReview(questions, mode, { srs = {}, history = [], links = {}, now = Date.now() } = {}) {
  const arr = [...questions];
  if (mode === 'forget') {
    arr.sort((a, b) => riskOf(b, srs, now) - riskOf(a, srs, now));
  } else if (mode === 'hard') {
    const diff = itemDifficulty(history);
    const d = (q) => (diff.get(q.id)?.difficulty ?? 0);
    arr.sort((a, b) => d(b) - d(a));
  } else if (mode === 'wrong') {
    const w = (q) => normalize(srs[q.id]).wrongCount || 0;
    arr.sort((a, b) => w(b) - w(a));
  } else if (mode === 'subject') {
    arr.sort((a, b) => String(a.subject).localeCompare(String(b.subject), 'ja'));
  } else {
    // 'due'：次回出題が近い順（期限切れ＝最優先）
    const due = (q) => normalize(srs[q.id]).due || 0;
    arr.sort((a, b) => due(a) - due(b));
  }
  return arr;
}
