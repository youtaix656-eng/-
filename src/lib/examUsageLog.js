// 模試で実際に出題した問題idの履歴（#11・#15・#16・#17・#18）。
//   直近の模試で使った問題をなるべく避けて出題することで、同じ問題セットの
//   使い回しによる「覚えているから解けた」を防ぐ。端末内のみ（外部送信なし）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:examUsageLog';
const MAX_ENTRIES = 20;

export async function loadExamUsageLog() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

// entry: { mode, ids: [...] }
export async function appendExamUsageLog(mode, ids) {
  const log = await loadExamUsageLog();
  const next = [{ mode, ids, at: Date.now() }, ...log].slice(0, MAX_ENTRIES);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 直近withinCount回（同じmode）で使われた問題idの集合（新しい方から数える）。
export function recentlyUsedIds(log, mode, { withinCount = 3 } = {}) {
  const set = new Set();
  let n = 0;
  for (const entry of log || []) {
    if (entry.mode !== mode) continue;
    for (const id of entry.ids || []) set.add(id);
    n += 1;
    if (n >= withinCount) break;
  }
  return set;
}

// 直近1回（同じmode）と今回の重複率（%、#15）。前回の記録が無ければnull。
export function overlapWithLast(log, mode, currentIds) {
  const last = (log || []).find((e) => e.mode === mode);
  if (!last || !last.ids || last.ids.length === 0 || !currentIds.length) return null;
  const lastSet = new Set(last.ids);
  const overlap = currentIds.filter((id) => lastSet.has(id)).length;
  return Math.round((overlap / currentIds.length) * 100);
}
