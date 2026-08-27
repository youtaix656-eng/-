// つまずき集（新規）。**同じ失敗を役職ごとに繰り返さない**ための記録。
//
// これまで失敗は step.error に残るだけで、誰も読み返していなかった。
// 仕事は起動時に新しい120件しか読まないので、失敗は**古い仕事ごと視界から消える**。
// そこで失敗だけを別に貯め、同じ役職の社員が仕事の前に読むようにする。
//
// 掲示板（lib/board.js）との違い：
//   掲示板   … 全員向け・業務連絡・30日で消える
//   つまずき … 役職別・失敗の型・消えない（手で消すまで）
//
// AIを1回も呼ばない（失敗した時に自動で1件足すだけ）。

import { newId } from './id.js';

export const MAX_PITFALLS = 60;
export const MAX_TEXT = 200;
export const READ_LIMIT = 3; // 仕事の前に読ませるのは新しい3件だけ

export function makePitfall({ roleId, roleName = '', text, taskTitle = '', employeeName = '' }) {
  return {
    id: newId('pit'),
    roleId: roleId || null,
    roleName: String(roleName || '').slice(0, 40),
    text: String(text || '').trim().slice(0, MAX_TEXT),
    taskTitle: String(taskTitle || '').slice(0, 60),
    employeeName: String(employeeName || '').slice(0, 40),
    count: 1,
    at: Date.now(),
  };
}

export function normalize(list) {
  return Array.isArray(list) ? list.filter((p) => p && p.id && p.text) : [];
}

/**
 * 1件足す。**同じ本文があれば回数を増やすだけ**にする。
 * 同じ失敗を何度もしていることが、件数ではなく回数で見えるようにするため。
 */
export function addPitfall(list, item) {
  const cur = normalize(list);
  if (!item || !item.text) return cur;
  const same = cur.find((p) => p.roleId === item.roleId && p.text === item.text);
  if (same) {
    return cur.map((p) => (p === same ? { ...p, count: (p.count || 1) + 1, at: Date.now() } : p));
  }
  return [...cur, item].slice(-MAX_PITFALLS);
}

export function removePitfall(list, id) {
  return normalize(list).filter((p) => p.id !== id);
}

/** その役職のつまずき（回数が多いもの・新しいものを優先）。 */
export function forRole(list, roleId, limit = READ_LIMIT) {
  return normalize(list)
    .filter((p) => p.roleId === roleId)
    .sort((a, b) => (b.count || 1) - (a.count || 1) || b.at - a.at)
    .slice(0, limit);
}

/** 社員に読ませる文。無ければ空（無理に出さない）。 */
export function pitfallPrompt(list, roleId) {
  const rows = forRole(list, roleId);
  if (!rows.length) return '';
  return [
    '## この役職で過去に起きたつまずき',
    ...rows.map((p) => `- ${p.text}${(p.count || 1) > 1 ? `（${p.count}回）` : ''}`),
    '同じことを繰り返さないでください。避けられない時は、その理由を書いてください。',
  ].join('\n');
}

// 実行時のエラー文は英語や状態番号が混ざる。**そのまま貯めない。**
// 何をすればよいかが分かる形だけを残す。
const NOISE = [/^\s*$/, /^[A-Za-z0-9 _:.\-/]+$/];

export function cleanError(message) {
  const t = String(message || '').split('\n')[0].trim();
  if (!t || NOISE.some((re) => re.test(t))) return '';
  return t.slice(0, MAX_TEXT);
}

/** 失敗した手順から、つまずきを1件作る（作れなければ null）。 */
export function fromFailedStep(step, task, roleName = '') {
  const text = cleanError(step && step.error);
  if (!text) return null;
  return makePitfall({
    roleId: step.roleId,
    roleName,
    text,
    taskTitle: (task && task.title) || '',
    employeeName: step.employeeName || '',
  });
}

/** 何度も起きているつまずき（会社のルールにすべき候補）。 */
export const REPEAT_AT = 2;

export function repeated(list) {
  return normalize(list)
    .filter((p) => (p.count || 1) >= REPEAT_AT)
    .sort((a, b) => (b.count || 1) - (a.count || 1));
}
