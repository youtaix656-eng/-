// 間違いの「型」記録（#9）— 誤答/△/✕のとき「勘違い・知識不足・ケアレス」をワンタップ記録。
//   端末内のみ（外部送信なし）。型別に復習の効かせ方を変える基礎データにする。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:missTypes';

export const MISS_TYPES = [
  { id: 'kanchigai', label: '勘違い', hint: '対比で整理' },
  { id: 'chishiki', label: '知識不足', hint: '解説を強化' },
  { id: 'careless', label: 'ケアレス', hint: '落ち着いて再確認' },
];

export function missTypeLabel(id) {
  return MISS_TYPES.find((t) => t.id === id)?.label || '';
}

export async function loadMissTypes() {
  try { return (await idbGet(KEY)) || {}; } catch (e) { return {}; }
}

export async function recordMissType(questionId, type) {
  const m = await loadMissTypes();
  m[questionId] = { type, at: Date.now() };
  try { await idbSet(KEY, m); } catch (e) { /* noop */ }
  return m;
}
