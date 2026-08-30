// 試験当日チェックリスト・タイムライン（⑧）— 持ち物・当日の流れを時系列で1画面にまとめる。
//   ここに挙げる項目は一般的な例であり、正式な持ち物・注意事項は必ず受験票・公式の
//   受験案内で最終確認すること（年度により変わるため、断定的な公式情報として記憶から
//   書かない＝CLAUDE.mdの数値・事実の鮮度管理と同じ理由）。
//   端末内のみ（外部送信なし）。チェック状態と追加した項目だけを保存する。

import { idbGet, idbSet } from './db.js';

const CHECKED_KEY = 'shinkyu:examDayChecked'; // { [itemId]: boolean }
const CUSTOM_KEY = 'shinkyu:examDayCustomItems'; // [{ id, stage, text }]

export const STAGES = [
  { id: 'before', label: '前日までに' },
  { id: 'morning', label: '当日の朝' },
  { id: 'arrival', label: '会場に着いたら' },
];

// 一般的な例。実際の持ち物・注意事項は必ず受験票・公式の受験案内で確認すること。
export const DEFAULT_ITEMS = [
  { id: 'd1', stage: 'before', text: '受験票を印刷・準備した（写真や記載内容を確認）' },
  { id: 'd2', stage: 'before', text: '会場までの経路・所要時間を確認した（乗換案内・地図）' },
  { id: 'd3', stage: 'before', text: '前日は詰め込みすぎず、早めに休んだ' },
  { id: 'm1', stage: 'morning', text: '受験票・筆記用具・身分証を持ったか確認した' },
  { id: 'm2', stage: 'morning', text: '時計（会場のルールに合うもの）を用意した' },
  { id: 'm3', stage: 'morning', text: '昼食・飲み物・防寒具など、待ち時間に困らない準備をした' },
  { id: 'a1', stage: 'arrival', text: '受付・座席の場所を確認した' },
  { id: 'a2', stage: 'arrival', text: 'お手洗いの場所を確認した' },
  { id: 'a3', stage: 'arrival', text: '直前は新しい知識を詰め込まず、深呼吸して落ち着く' },
];

function newId() {
  return `cd-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

export async function loadChecked() {
  try { return (await idbGet(CHECKED_KEY)) || {}; } catch (e) { return {}; }
}

export async function setChecked(itemId, done) {
  const all = await loadChecked();
  all[itemId] = done;
  try { await idbSet(CHECKED_KEY, all); } catch (e) { /* noop */ }
  return all;
}

export async function loadCustomItems() {
  try { return (await idbGet(CUSTOM_KEY)) || []; } catch (e) { return []; }
}

export async function addCustomItem(stage, text) {
  const all = await loadCustomItems();
  const next = [...all, { id: newId(), stage, text: String(text).trim() }];
  try { await idbSet(CUSTOM_KEY, next); } catch (e) { /* noop */ }
  return next;
}

export async function removeCustomItem(itemId) {
  const all = await loadCustomItems();
  const next = all.filter((i) => i.id !== itemId);
  try { await idbSet(CUSTOM_KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 既定＋追加項目をステージごとにまとめ、進捗（完了数/全体数）も返す
export function buildChecklist(customItems, checked) {
  const all = [...DEFAULT_ITEMS, ...(customItems || [])];
  const byStage = STAGES.map((s) => ({
    ...s,
    items: all.filter((i) => i.stage === s.id).map((i) => ({ ...i, done: !!(checked || {})[i.id] })),
  }));
  const total = all.length;
  const done = all.filter((i) => (checked || {})[i.id]).length;
  return { byStage, total, done };
}
