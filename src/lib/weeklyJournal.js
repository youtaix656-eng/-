// 週次の弱点ジャーナル — 直近7日間の解答から週報を自動生成し、来週の方針を
//   自分で一言書き込める（3分の2バッファ術のマネージャービューと同じ「悪いのは
//   実行役ではなく無理な計画を立てたマネージャー」という前向きな前提でまとめる）。
//   端末内のみ（外部送信なし）。

import { idbGet, idbSet } from './db.js';
import { weakTagClusters } from './weakClusters.js';

const KEY = 'shinkyu:weeklyJournal'; // { [weekKey]: { note, at } }
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// 週の始まり（月曜0時）のタイムスタンプ
export function weekStartOf(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=日, 1=月, ...
  const diff = (day === 0 ? -6 : 1) - day; // 直近の月曜まで戻す
  d.setDate(d.getDate() + diff);
  return d.getTime();
}

export function weekKeyOf(date = new Date()) {
  return String(weekStartOf(date));
}

export async function loadWeeklyNotes() {
  try { return (await idbGet(KEY)) || {}; } catch (e) { return {}; }
}

export async function saveWeeklyNote(weekKey, note) {
  const all = await loadWeeklyNotes();
  all[weekKey] = { note: String(note).trim(), at: Date.now() };
  try { await idbSet(KEY, all); } catch (e) { /* noop */ }
  return all;
}

// 直近7日間（現在時刻を含む、当日を含む）の解答から週報を自動生成する
export function buildWeeklyReport(history = [], missTypes = {}, questions = [], links = {}, now = Date.now()) {
  const since = now - WEEK_MS;
  const weekHistory = history.filter((h) => h.at >= since);
  const total = weekHistory.length;
  const correct = weekHistory.filter((h) => h.correct).length;
  const accuracy = total > 0 ? correct / total : null;

  const wrongIds = [...new Set(weekHistory.filter((h) => !h.correct).map((h) => h.questionId))];
  const typeCounts = {};
  for (const id of wrongIds) {
    const t = missTypes[id]?.type;
    if (t) typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const weakTags = weakTagClusters(weekHistory, questions, links, { minWrong: 1, limit: 5 });

  return { since, total, correct, accuracy, wrongCount: wrongIds.length, typeCounts, topType, weakTags };
}
