// 音声学習（AudioMode.jsx）の「間違えた問題を読み上げる」の実施ログ。
// いつ・どの件数（10・60・300・900・すべて）で始め、最後まで聞き終えたかを記録する
// 唯一の発生源（端末内のみ）。分析画面の「音声だけでの復習回数」と、件数チップの横に
// 出す「よく使う組み合わせ」「無理のない件数のおすすめ」は、どちらもこのログだけを参照する。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:audioReviewLog';
const MAX_ENTRIES = 80;

export async function loadAudioReviewLog() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

// entry: { target: number|null, subject: string|null, n: number }
export async function recordAudioReviewStart(entry) {
  const log = await loadAudioReviewLog();
  const next = [{ kind: 'start', ...entry, at: Date.now() }, ...log].slice(0, MAX_ENTRIES);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// entry: { target: number|null, subject: string|null, n: number, graded: number, wrong: number }
export async function recordAudioReviewFinish(entry) {
  const log = await loadAudioReviewLog();
  const next = [{ kind: 'finish', ...entry, at: Date.now() }, ...log].slice(0, MAX_ENTRIES);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 直近30日の「音声だけでの復習」実施回数（開始した回数。分析画面向け）。
export function audioReviewCountSince(log, sinceMs) {
  const since = sinceMs ?? Date.now() - 30 * 24 * 60 * 60 * 1000;
  return (log || []).filter((e) => e.kind === 'start' && e.at >= since).length;
}

// 件数（target、nullは「すべて」）ごとの開始数・完了数・完了率。
// 完了率が低い（途中でやめがち）件数を見分けて、無理のない件数をおすすめするために使う。
export function completionRateByTarget(log) {
  const starts = new Map();
  const finishes = new Map();
  for (const e of log || []) {
    const key = e.target == null ? 'all' : String(e.target);
    if (e.kind === 'start') starts.set(key, (starts.get(key) || 0) + 1);
    if (e.kind === 'finish') finishes.set(key, (finishes.get(key) || 0) + 1);
  }
  const out = {};
  for (const [key, starts_] of starts) {
    const fin = finishes.get(key) || 0;
    out[key] = { starts: starts_, finishes: fin, rate: starts_ > 0 ? fin / starts_ : null };
  }
  return out;
}

// よく使う「科目×件数」の組み合わせ（開始回数の多い順）。1回だけ使ったものは
// 「よく使う」とは言えないため、2回以上使った組み合わせだけを対象にする。
export function topCombos(log, limit = 3) {
  const counts = new Map();
  for (const e of log || []) {
    if (e.kind !== 'start') continue;
    const key = `${e.subject || ''}|${e.target == null ? '' : e.target}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => {
      const [subject, targetStr] = key.split('|');
      return { subject: subject || null, target: targetStr ? Number(targetStr) : null, count };
    });
}

// topCombosが0件（2回以上使った組み合わせがまだ無い）時に、直近1回だけの組み合わせを
// 薄く案内するための代わり（改善案#4）。「よく使う」とは言えないことが伝わるよう、
// 呼び出し側で別の見た目（薄い表示）にすること。
export function recentCombo(log) {
  const last = (log || []).find((e) => e.kind === 'start');
  if (!last) return null;
  return { subject: last.subject || null, target: last.target ?? null };
}

// 同じ件数(target)・同じ科目の直前の完了実績（終了時の正答率比較に使う、新規#1）。
// 今回のrecordAudioReviewFinishを呼ぶ前のログに対して呼ぶこと（呼んだ後だと自分自身が
// 「直前」として返ってしまう）。genre・roundも渡すと、それらも一致した時だけ比較対象にする
// （第2弾改善：以前は科目一致だけだったため、ジャンル・回で絞った時は比較が効かなかった）。
export function previousFinish(log, { target, subject, genre = null, round = null }) {
  const found = (log || []).find(
    (e) =>
      e.kind === 'finish' &&
      e.target === target &&
      (e.subject || null) === (subject || null) &&
      (e.genre || null) === (genre || null) &&
      (e.round || null) === (round || null)
  );
  if (!found || !found.graded) return null;
  return { graded: found.graded, wrong: found.wrong, accuracyPct: Math.round(((found.graded - found.wrong) / found.graded) * 100) };
}

// 科目別の完了率（件数の軸しかなかった completionRateByTarget の科目版）。
export function completionRateBySubject(log) {
  const starts = new Map();
  const finishes = new Map();
  for (const e of log || []) {
    const key = e.subject || '全科目';
    if (e.kind === 'start') starts.set(key, (starts.get(key) || 0) + 1);
    if (e.kind === 'finish') finishes.set(key, (finishes.get(key) || 0) + 1);
  }
  const out = {};
  for (const [key, starts_] of starts) {
    const fin = finishes.get(key) || 0;
    out[key] = { starts: starts_, finishes: fin, rate: starts_ > 0 ? fin / starts_ : null };
  }
  return out;
}

function escCsv(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// 実施ログの書き出し（Review.jsxの要注意一覧CSVと同じパターン）。
export function logToCsv(log) {
  const header = ['種別', '日時', '件数', '科目', '自己採点数', '誤答数'];
  const rows = (log || []).map((e) =>
    [
      e.kind === 'start' ? '開始' : '完了',
      e.at ? new Date(e.at).toLocaleString('ja-JP') : '',
      e.target == null ? 'すべて' : e.target,
      e.subject || '全科目',
      e.graded ?? '',
      e.wrong ?? '',
    ]
      .map(escCsv)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

// 音声だけでの復習を最後に実施（完了）した日から何日経過したか。一度も無ければnull
// （毎日のリマインド通知に相乗りさせる、新規#8と同じ考え方＝reviewZeroLog等と同じ形）。
export function daysSinceLastAudioReview(log, now = Date.now()) {
  const finishes = (log || []).filter((e) => e.kind === 'finish');
  if (!finishes.length) return null;
  const latest = Math.max(...finishes.map((e) => e.at || 0));
  return Math.floor((now - latest) / (24 * 60 * 60 * 1000));
}
