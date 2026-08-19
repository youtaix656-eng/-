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

// 型別の再出題までの間隔。ケアレスは短め（もう一度落ち着いて確認）、
//   知識不足は長め（解説を読み込む時間を作ってから再出題）。既定（型なし）は20分。
export const MISS_TYPE_DELAY_MS = {
  careless: 10 * 60 * 1000,
  kanchigai: 20 * 60 * 1000,
  chishiki: 24 * 60 * 60 * 1000,
};

export async function loadMissTypes() {
  try { return (await idbGet(KEY)) || {}; } catch (e) { return {}; }
}

export async function recordMissType(questionId, type) {
  const m = await loadMissTypes();
  m[questionId] = { type, at: Date.now() };
  try { await idbSet(KEY, m); } catch (e) { /* noop */ }
  return m;
}
