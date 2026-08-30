// 予定1件の作り方だけを置く、小さなファイル。
//
// 新項目：`useStore.js` は「予定を1件作る」ためだけに schedule.js を読んでいた。
// schedule.js はカレンダーの組み立て（月のマス目・日ごとの中身・日付索引）まで持つ
// 8KB のファイルで、**カレンダーは lazy なのに、この import だけで起動時の束へ入っていた**。
// notes.js（memory.js から切り出し）・announce.js（resume.js から切り出し）と同じ形で、
// 起動時に要るものだけをここに置く。
//
// schedule.js からも再輸出しているので、カレンダー側の import は変えなくてよい。

import { newId } from './id.js';

export const DAY_MS = 86400000;

export const EVENT_KINDS = [
  { id: 'plan', name: '予定', glyph: '■', reading: 'よてい' },
  { id: 'deliver', name: '納品', glyph: '▲', reading: 'のうひん' },
  { id: 'contact', name: '連絡・営業', glyph: '✉', reading: 'れんらくえいぎょう' },
  { id: 'rest', name: '休み', glyph: '○', reading: 'やすみ' },
];

/** その日の 0:00 のミリ秒。 */
export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function makeEvent({ title, at, kind = 'plan', dealId = null, note = '' }) {
  const clean = String(title || '').trim();
  if (!clean) throw new Error('予定の内容を入れてください');
  return {
    id: newId('ev'),
    title: clean.slice(0, 60),
    at: startOfDay(at || Date.now()),
    kind: EVENT_KINDS.some((k) => k.id === kind) ? kind : 'plan',
    dealId,
    note: String(note || '').slice(0, 300),
    done: false,
    createdAt: Date.now(),
  };
}
