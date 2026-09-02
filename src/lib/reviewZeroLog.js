// 「復習を毎日ゼロに戻す」運用そのものを支援するログ（#1・#3・#5・#14・#19・#26・#29）。
//   仕組み（要注意・忘却予測・弱点クラスタ等）は既に十分強力なので、ここでは
//   「実際に毎日ゼロへ戻せているか」を可視化するための日次の記録だけを持つ。
//   端末内のみ（IndexedDB）。1日1エントリ、冪等（同じ日に何度呼んでも上書きされるだけ）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:reviewZeroLog';
const MAX_DAYS = 120; // 古いものは間引く（際限なく増やさない）

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function loadReviewZeroLog() {
  try { return (await idbGet(KEY)) || {}; } catch (e) { return {}; }
}

// 今日、復習（due）がゼロになった瞬間を記録する（1日1回だけ実際に書き込む）。
export async function markReviewZeroToday(now = Date.now()) {
  const log = await loadReviewZeroLog();
  const key = dayKey(new Date(now));
  if (log[key]) return log; // 既に今日ぶんは記録済み（冪等）
  const next = { ...log, [key]: now };
  const keys = Object.keys(next).sort();
  while (keys.length > MAX_DAYS) delete next[keys.shift()];
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 直近days日のうち、ゼロを達成した日数（「◯日中◯日」形式。連続日数は煽らない）。
export function zeroDaysSummary(log, days = 30, now = Date.now()) {
  let achieved = 0;
  const DAY = 24 * 60 * 60 * 1000;
  for (let i = 0; i < days; i++) {
    if (log[dayKey(new Date(now - i * DAY))]) achieved += 1;
  }
  return { achieved, total: days };
}

// 最後にゼロを達成してから何日経っているか（0＝今日達成済み、nullは記録が1件も無い）。
export function daysSinceLastZero(log, now = Date.now()) {
  const keys = Object.keys(log || {});
  if (keys.length === 0) return null;
  const latest = keys.sort().at(-1);
  const [y, m, d] = latest.split('-').map(Number);
  const latestMs = new Date(y, m - 1, d).getTime();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - latestMs) / (24 * 60 * 60 * 1000)));
}

// 曜日別のゼロ達成率（0=日曜〜6=土曜）。母数が少ない曜日は信頼度が低いので count も返す。
export function zeroRateByWeekday(log, days = 60, now = Date.now()) {
  const DAY = 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: 7 }, () => ({ achieved: 0, total: 0 }));
  for (let i = 0; i < days; i++) {
    const d = new Date(now - i * DAY);
    const b = buckets[d.getDay()];
    b.total += 1;
    if (log[dayKey(d)]) b.achieved += 1;
  }
  return buckets.map((b, weekday) => ({ weekday, ...b, rate: b.total ? b.achieved / b.total : 0 }));
}

// #29：ゼロ達成ログをCSVに書き出す（日付・達成の有無）。
export function reviewZeroLogToCsv(log) {
  const header = ['日付', '復習ゼロを達成'];
  const rows = Object.keys(log || {})
    .sort()
    .map((key) => [key, '達成']);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

// 「毎日の仕上げ実施率」（#14）：復習ゼロ or ○ふりかえり（history上のsource:'maru-review'）の
//   どちらかを行った日を「仕上げた日」として、直近days日の実施率を返す。
export function finishDaysSummary(log, history, days = 30, now = Date.now()) {
  const DAY = 24 * 60 * 60 * 1000;
  const maruDayKeys = new Set(
    (history || [])
      .filter((h) => h.source === 'maru-review')
      .map((h) => dayKey(new Date(h.at)))
  );
  let achieved = 0;
  for (let i = 0; i < days; i++) {
    const key = dayKey(new Date(now - i * DAY));
    if (log[key] || maruDayKeys.has(key)) achieved += 1;
  }
  return { achieved, total: days };
}
