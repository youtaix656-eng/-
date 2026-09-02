// 勉強フェーズ終了時の「集中できたか」セルフチェック（任意記録）。
// missTypes.js・starWeak.js と同じ、端末内だけの軽量ストア（バックアップ対象外）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:pomoFocus';
const MAX_ENTRIES = 300;

export const FOCUS_LEVELS = [
  { level: 3, ico: '😃', label: '集中できた' },
  { level: 2, ico: '😐', label: 'まあまあ' },
  { level: 1, ico: '😞', label: 'あまり…' },
];

export async function loadPomoFocus() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

export async function appendPomoFocus(level, at = Date.now()) {
  const log = await loadPomoFocus();
  const next = [...log, { level, at }].slice(-MAX_ENTRIES);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

/** sinceMs以降の平均レベル（1〜3）。記録が無ければnull（0点として扱わない）。 */
export function focusAverageSince(log, sinceMs) {
  const rows = (log || []).filter((e) => e.at >= sinceMs);
  if (rows.length === 0) return null;
  return rows.reduce((s, e) => s + e.level, 0) / rows.length;
}
