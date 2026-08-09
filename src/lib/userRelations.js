// ユーザー定義の関係（#29 関係オーサリング）— 自分で概念どうしを型付きで結ぶ。
//   端末内に保存し、知識グラフへ強い辺として合流させる。

import { idbGet, idbSet } from './db.js';
import { validateRelation } from './relations.js';

const KEY = 'shinkyu:userRelations';

export async function loadUserRelations() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}
export async function saveUserRelations(list) {
  try { await idbSet(KEY, list); } catch (e) { /* noop */ }
}

// 追加（妥当なら）。重複（from,to,type一致）は無視。新しい配列を返す。
export async function addUserRelation(rel) {
  if (validateRelation(rel).length) return null;
  const list = await loadUserRelations();
  const dup = list.some((r) => r.from === rel.from && r.to === rel.to && r.type === rel.type);
  const next = dup ? list : [...list, { from: rel.from, to: rel.to, type: rel.type, at: Date.now() }];
  await saveUserRelations(next);
  return next;
}

export async function removeUserRelation(idx) {
  const list = await loadUserRelations();
  const next = list.filter((_, i) => i !== idx);
  await saveUserRelations(next);
  return next;
}
