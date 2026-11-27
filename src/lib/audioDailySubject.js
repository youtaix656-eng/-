// 音声学習×連結学習：一番上の「赤い長丸」ボタン（国家試験の科目×過去に間違えたところ）が
// 単一の正として使う、日替わりの「今日の科目」ロジック。
//
// 【2026-11-14改訂】当初はカレンダーの日付から決定的に求める方式（dayIndex % 14。他の
// 日替わり機能＝priorityFocus.js／coveragePriority.js／forgetting.jsのdailyForgettingPickと
// 同じ考え方）にしていたが、これは「前日に実際に演習した科目」を一切追跡しないため、
// ユーザーから「解剖学をやったので、その次（生理学）から始められるようにして」と
// 指摘された（実際に試した日に、無関係な科目が出ていた）。正しくは**持続化された状態**
// （直近にセットした科目の添字＋その添字をセットした日付）を持ち、日付が変わった時だけ
// 1つ進める方式でなければ「前日に演習した科目」を意味のある形で追跡できない——これが
// 見つかったバグで、本ファイルはその修正版。
//
// settings.audioDailySubjectRotation = { index, dateKey } として AudioMode.jsx が保存する
// （1日の中で何度開いても同じ添字のまま。日付が変わった時だけ1つ進める）。保存状態がまだ
// 無い最初の1回だけ、ユーザー指定の初期値（解剖学の次＝生理学）を使う。

import { SUBJECT_TAG_NAMES } from '../data/examScope.js';
import { isInReview, isDue } from './srs.js';
import { dateKey } from './connect.js';

// 初回（保存状態がまだ無い端末）の既定値。2026-11-14、ユーザーが「解剖学をやったので
// その次（生理学）から始められるようにして」と指定したため、先頭（医療概論）ではなく
// ここから始める。以後は保存された状態から日が変わるごとに1つずつ進む。
const DEFAULT_SUBJECT = '生理学';
const DEFAULT_INDEX = Math.max(0, SUBJECT_TAG_NAMES.indexOf(DEFAULT_SUBJECT));

// 保存状態（stored：{index, dateKey}。未保存ならnull/undefined）から、「今日使うべき添字」を
// 決定する。同じ日なら保存されている添字のまま変えない（1日の中で何度開いても同じ科目になる）。
// 日付が変わった時だけ1つ進める（1▶2▶3▶4▶…▶14▶1…）。changed:true の時は呼び出し側
// （AudioMode.jsx）が新しい{index, dateKey}を保存すること。
export function resolveDailySubjectIndex(stored, now = new Date()) {
  const today = dateKey(now);
  if (!stored || typeof stored.index !== 'number') {
    return { index: DEFAULT_INDEX, dateKey: today, changed: true };
  }
  if (stored.dateKey === today) {
    return { index: stored.index, dateKey: today, changed: false };
  }
  const n = SUBJECT_TAG_NAMES.length;
  const nextIndex = ((stored.index % n) + n + 1) % n;
  return { index: nextIndex, dateKey: today, changed: true };
}

// 添字→科目名（範囲外・負の値でも安全に循環させる）。
export function subjectAt(index) {
  const n = SUBJECT_TAG_NAMES.length;
  return SUBJECT_TAG_NAMES[((index % n) + n) % n];
}

// 指定した科目のうち、過去に誤答した・△✕の問題（isInReview＝wrongCount>0かつ未マスター）だけに
// 絞り込んだプール。reviewPoolFor（lib/reviewPool.js）とは違い、一度も間違えていないが
// 忘却リスクが高い「念のため確認」は混ぜない——「過去に誤答した・△✕の問題に絞り込んで」という
// 要望どおり、厳密に「一度でも間違えた問題」だけにする。期限が来ている（isDue）問題を
// 先頭に出す（reviewPoolForと同じ優先順位の考え方）。
export function subjectWrongPool(questions, srs, subject) {
  const inSubject = questions.filter((q) => q.subject === subject);
  const wrong = inSubject.filter((q) => isInReview(srs[q.id]));
  const due = wrong.filter((q) => isDue(srs[q.id]));
  const rest = wrong.filter((q) => !isDue(srs[q.id]));
  return { subject, pool: [...due, ...rest] };
}

// 今日の科目に誤答・△✕が1問も無い日に、ボタンが押せなくなって行き止まりになっていた
// （ほかの科目には誤答が溜まっていても回す道が無かった）。今日の科目から順番どおりに
// 次の科目を見ていき、誤答・△✕がある最初の科目を返す。保存している日替わりの添字は変えない
// （明日の科目の順番はそのまま）。どの科目にも無ければ today の空のプールを返す。
export function dailyWrongPickWithFallback(questions, srs, index) {
  const today = subjectWrongPool(questions, srs, subjectAt(index));
  if (today.pool.length > 0) return { ...today, todaySubject: today.subject, fallback: false };
  for (let k = 1; k < SUBJECT_TAG_NAMES.length; k += 1) {
    const p = subjectWrongPool(questions, srs, subjectAt(index + k));
    if (p.pool.length > 0) return { ...p, todaySubject: today.subject, fallback: true };
  }
  return { ...today, todaySubject: today.subject, fallback: false };
}

// 手動で選んだ科目（2026-11-27・ユーザー指定「下に1〜14科目の箱を横に並べ、タップすると誤答・△✕が選ばれる」）。
// settings.audioDailyManualSubject = { dateKey, subject }。その日のうちだけ効き、日付が変わったら
// 自動の「今日の科目」へ戻る。日替わりの順番（1▶2▶3…）は手動で選んでも変えない。
export function manualSubjectFor(stored, now = new Date()) {
  if (!stored || typeof stored.subject !== 'string' || !SUBJECT_TAG_NAMES.includes(stored.subject)) return null;
  return stored.dateKey === dateKey(now) ? stored.subject : null;
}

// 赤い長丸で使う束。手動で選んだ科目があればその科目だけ（誤答が無くても他の科目へ回さない＝
// 選んだ科目と違う問題が始まらないように）、無ければ今日の科目（無ければ次の誤答がある科目へ回す）。
export function pillPick(questions, srs, index, manualSubject) {
  if (manualSubject) {
    const p = subjectWrongPool(questions, srs, manualSubject);
    return { ...p, todaySubject: subjectAt(index), fallback: false, manual: true };
  }
  return { ...dailyWrongPickWithFallback(questions, srs, index), manual: false };
}

// 科目ごとの誤答・△✕の数（箱に出す数）
export function wrongCountBySubject(questions, srs) {
  const m = new Map(SUBJECT_TAG_NAMES.map((s) => [s, 0]));
  questions.forEach((q) => { if (m.has(q.subject) && isInReview(srs[q.id])) m.set(q.subject, m.get(q.subject) + 1); });
  return m;
}
