// 連想の間隔反復・持続化（#25 連結の復習モード / #22 対比識別ドリル）。
//   概念間のつながり（キーで識別）ごとに Leitner 式の復習状態を端末内に保存する。
//   edgeSrs.js のスケジュールを流用し、想起の成否で次回間隔を更新する。

import { idbGet, idbSet } from './db.js';
import { scheduleEdge, isEdgeDue } from './edgeSrs.js';

const KEY = 'shinkyu:assocReview';

// つながりのキー（無向）：連結リコール用
export function assocKey(a, b) {
  return a < b ? `as:${a}|${b}` : `as:${b}|${a}`;
}
// 対比ドリル用のキー
export function comparisonKey(id) {
  return `cmp:${id}`;
}

export async function loadAssocReview() {
  try { return (await idbGet(KEY)) || {}; } catch (e) { return {}; }
}
export async function saveAssocReview(map) {
  try { await idbSet(KEY, map); } catch (e) { /* noop */ }
}

// 純粋：想起の成否でスケジュールを更新した新しいマップを返す。
export function gradeAssoc(map, key, correct, now = Date.now()) {
  const next = { ...(map || {}) };
  next[key] = scheduleEdge(next[key], correct, now);
  return next;
}

// 復習期限が来ているキーか（未登録は対象）。
export function isAssocDue(map, key, now = Date.now()) {
  return isEdgeDue((map || {})[key], now);
}

// 候補（キー付き）のうち、期限が来ているものを優先して並べる。
//   items: [{ key, ...任意 }]。due を先頭、その中は登録の浅い順。
export function orderByDue(map, items, now = Date.now()) {
  const withState = items.map((it) => ({ ...it, due: isAssocDue(map, it.key, now), box: (map?.[it.key]?.box) || 0 }));
  withState.sort((a, b) => (b.due - a.due) || (a.box - b.box));
  return withState;
}
