// 人間分析の見立てを、端末内に残す。
//
// 守ること:
//   1. **保存するのは「チェックした内容」であって、判定結果ではない。**
//      型やふるまいをあとから直しても、過去の見立てを読み直せる
//      （腰痛ナビのカルテと同じ考え方）。判定は開くたびに計算し直す。
//   2. **氏名・連絡先を欄として持たない。** 持つのは自由記述の「呼び名」だけで、
//      電話番号・メール・リンクが混ざっていたら伏せる。
//      端末を見られる可能性があるなら、本名ではなく呼び名を勧める（画面に書く）。
//   3. **判定（どういう人か）を保存しない。** score も verdict も持たない。
//   4. **ネットワークに触れない。** 保存先は storage.js（localStorage）だけ。

import { mask } from './privacy.js';

let seq = 0;

/**
 * 見立ての id を作る。
 * **画面側でも同じものを使う**——新しく保存した直後に「編集中」へ移るには、
 * 保存する前に id が決まっている必要がある（保存の戻り値を待つと、
 * React の更新の順番によっては受け取れないことがある）。
 */
export function newCaseId(now = Date.now()) {
  seq += 1;
  return `c${now}-${seq}`;
}

const newId = newCaseId;

/** 呼び名の上限（長い本文を貼り付けて記録にしてしまわないため） */
export const LABEL_MAX = 40;
export const NOTE_MAX = 400;

function clean(text, max) {
  return mask(String(text || '')).slice(0, max).trim();
}

/**
 * 見立てを1件作る。
 * @param {{label?:string, sceneId?:string, checkedIds?:string[], note?:string, at?:number}} input
 */
export function makeCase(input = {}) {
  const at = Number(input.at) || Date.now();
  return {
    id: input.id || newId(at),
    label: clean(input.label, LABEL_MAX),
    sceneId: input.sceneId || '',
    // 保存するのは入力（チェックしたふるまいの id）だけ
    checkedIds: [...new Set((input.checkedIds || []).filter(Boolean))],
    note: clean(input.note, NOTE_MAX),
    createdAt: Number(input.createdAt) || at,
    updatedAt: at,
  };
}

/** 既存の見立てを書き換える（id と作成日時は変えない） */
export function updateCase(existing, patch = {}, at = Date.now()) {
  return {
    ...existing,
    label: patch.label === undefined ? existing.label : clean(patch.label, LABEL_MAX),
    sceneId: patch.sceneId === undefined ? existing.sceneId : patch.sceneId,
    checkedIds:
      patch.checkedIds === undefined
        ? existing.checkedIds
        : [...new Set(patch.checkedIds.filter(Boolean))],
    note: patch.note === undefined ? existing.note : clean(patch.note, NOTE_MAX),
    updatedAt: at,
  };
}

/**
 * 外から来た見立てを、画面が触れる形にそろえる。
 *
 * **足りない欄を黙って undefined のままにしない。** 取り込んだファイルに
 * `checkedIds` や `note` が無いだけで画面が落ち、下部ナビごと消えて戻れなくなった
 * （実際に踏んだ）。ここを通していないものを画面へ渡さないこと。
 */
/** 文字列でないものを文字にしない（数や入れ物が「42」「[object Object]」になって残る） */
function text(value, max) {
  return typeof value === 'string' ? clean(value, max) : '';
}

export function normalizeCase(input, at = Date.now()) {
  if (!input || !input.id) return null;
  const created = Number(input.createdAt) || Number(input.updatedAt) || at;
  return {
    id: String(input.id),
    label: text(input.label, LABEL_MAX),
    sceneId: typeof input.sceneId === 'string' ? input.sceneId : '',
    checkedIds: Array.isArray(input.checkedIds)
      ? [...new Set(input.checkedIds.filter((x) => typeof x === 'string' && x))]
      : [],
    note: text(input.note, NOTE_MAX),
    createdAt: created,
    updatedAt: Number(input.updatedAt) || created,
    snapshots: Array.isArray(input.snapshots)
      ? input.snapshots
          .filter((sn) => sn && Array.isArray(sn.checkedIds))
          .map((sn) => ({ at: Number(sn.at) || created, checkedIds: sn.checkedIds.filter(Boolean) }))
      : [],
    seenAt: input.seenAt && typeof input.seenAt === 'object' && !Array.isArray(input.seenAt) ? input.seenAt : {},
    stage: Number.isFinite(Number(input.stage)) ? Number(input.stage) : 0,
    status: typeof input.status === 'string' && input.status ? input.status : 'open',
    nextAction: text(input.nextAction, LABEL_MAX * 3),
    nextMeetAt: /^\d{4}-\d{2}-\d{2}$/.test(String(input.nextMeetAt || '')) ? input.nextMeetAt : '',
  };
}

/** 新しく直したものが上 */
export function sortCases(cases = []) {
  return [...cases].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 呼び名が空でも一覧で見分けられるようにする（日付で代用。氏名を強いない） */
export function displayName(c) {
  if (c.label) return c.label;
  const d = new Date(c.createdAt);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} の見立て`;
}
