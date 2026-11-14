// 音声学習×連結学習：一番上の「赤い長丸」ボタン（国家試験の科目×過去に間違えたところ）が
// 単一の正として使う、日替わりの「今日の科目」ロジック。
//
// 「前日に演習した科目は次の日になると次の科目に切り替わる（1▶2▶3▶4）」という要望を、
// 他の日替わり機能（priorityFocus.js／coveragePriority.js／forgetting.jsのdailyForgettingPick）
// と同じ「dayIndex方式」（カレンダーの日付から決定的に求める。持続化する状態を持たない）で満たす。
// この方式なら、端末間で「前回どの科目だったか」を同期する必要がなく、同じ日であれば
// 常に同じ科目になる（クラウド同期・複数端末でも食い違わない）。
//
// examScope.jsのSUBJECT_TAG_NAMES（14科目、1〜14番の正式な並び）を単一の正として使う。

import { SUBJECT_TAG_NAMES } from '../data/examScope.js';
import { isInReview, isDue } from './srs.js';

function dayIndex(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const diff = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start;
  return Math.floor(diff / 86400000);
}

// 今日の科目名（SUBJECT_TAG_NAMESのうち1件）。
export function todaySubject(date = new Date()) {
  return SUBJECT_TAG_NAMES[dayIndex(date) % SUBJECT_TAG_NAMES.length];
}

// 今日の科目のうち、過去に誤答した・△✕の問題（isInReview＝wrongCount>0かつ未マスター）だけに
// 絞り込んだプール。reviewPoolFor（lib/reviewPool.js）とは違い、一度も間違えていないが
// 忘却リスクが高い「念のため確認」は混ぜない——「過去に誤答した・△✕の問題に絞り込んで」という
// 要望どおり、厳密に「一度でも間違えた問題」だけにする。期限が来ている（isDue）問題を
// 先頭に出す（reviewPoolForと同じ優先順位の考え方）。
export function todaySubjectWrongPool(questions, srs, date = new Date()) {
  const subject = todaySubject(date);
  const inSubject = questions.filter((q) => q.subject === subject);
  const wrong = inSubject.filter((q) => isInReview(srs[q.id]));
  const due = wrong.filter((q) => isDue(srs[q.id]));
  const rest = wrong.filter((q) => !isDue(srs[q.id]));
  return { subject, pool: [...due, ...rest] };
}
