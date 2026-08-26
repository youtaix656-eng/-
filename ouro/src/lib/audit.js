// Audit Log — AI社員のすべての操作を残す。
// 追記のみ（既存エントリを書き換えない）。端末内にのみ保存する。

import { newId } from './id.js';

export const AUDIT_LIMIT = 2000;

export const ACTIONS = {
  taskCreated: '仕事を受けた',
  stepRun: '実行した',
  stepFailed: '失敗した',
  knowledgeCreated: '知識を作った',
  knowledgeUpdated: '知識を更新した',
  knowledgeDeleted: '知識を削除した',
  employeeHired: '社員を雇った',
  genreAdded: 'ジャンルを足した',
  employeeArchived: '社員を休職にした',
  approvalRequested: '承認を求めた',
  approvalGranted: '承認した',
  approvalDenied: '却下した',
  connectionChanged: '道具の接続を変えた',
  dealChanged: '案件を更新した',
  meetingHeld: '会議を開いた',
  folded: 'まとめた記録',
};

export function makeEntry({ actor, action, target, detail, cost = 0 }) {
  return {
    id: newId('log'),
    at: Date.now(),
    actor: actor || 'user', // 'user' か employeeId
    action,
    target: target || '',
    detail: detail || '',
    cost,
  };
}

/** 追記して上限を超えた分だけ古いものを落とす。 */
export function appendAudit(list = [], entry) {
  const next = [...list, entry];
  return next.length > AUDIT_LIMIT ? next.slice(next.length - AUDIT_LIMIT) : next;
}

// ── 古い記録を畳む（新項目08）──
//
// 操作履歴は消さない。ただし古いぶんまで1件ずつ持ち続けると、読み出しも保存も重くなる。
// そこで「一定より古いぶんは、日ごとに1件へまとめる」。件数と費用は残るので
// 「いつ何件動かして、いくらかかったか」は後からでも分かる。
// **消すのではなく畳む**——監査の記録なので、無かったことにはしない。

export const FOLD_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30日
export const FOLD_ACTION = 'folded';

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 古い記録を日ごとに1件へまとめる。
 * @returns {{list: Array, folded: number}} folded は畳んだ元の件数（0なら変化なし）
 */
export function foldAudit(list = [], { now = Date.now(), olderThan = FOLD_AFTER_MS } = {}) {
  const cutoff = now - olderThan;
  const old = [];
  const keep = [];
  for (const e of list) {
    // すでに畳んだものは二重に畳まない
    if (e && e.action !== FOLD_ACTION && Number(e.at) > 0 && e.at < cutoff) old.push(e);
    else keep.push(e);
  }
  if (old.length < 2) return { list, folded: 0 };

  const byDay = new Map();
  for (const e of old) {
    const k = dayKey(e.at);
    const cur = byDay.get(k) || { at: e.at, count: 0, cost: 0, actions: new Map() };
    cur.at = Math.min(cur.at, e.at);
    cur.count += 1;
    cur.cost += Number(e.cost) || 0;
    cur.actions.set(e.action, (cur.actions.get(e.action) || 0) + 1);
    byDay.set(k, cur);
  }

  const foldedEntries = [...byDay.entries()].map(([day, v]) => {
    const breakdown = [...v.actions.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([a, n]) => `${actionLabel(a)}${n}`)
      .join('・');
    return {
      id: `fold_${day}`,
      at: v.at,
      actor: 'user',
      action: FOLD_ACTION,
      target: `${day} の記録`,
      detail: `${v.count}件（${breakdown}）`,
      cost: v.cost,
      count: v.count,
    };
  });

  const merged = [...foldedEntries, ...keep].sort((a, b) => (a.at || 0) - (b.at || 0));
  return { list: merged, folded: old.length };
}

export function actionLabel(action) {
  return ACTIONS[action] || action;
}

/** 期間内のコスト合計（USD）。 */
export function totalCost(list = [], since = 0) {
  return list.filter((e) => e.at >= since).reduce((sum, e) => sum + (e.cost || 0), 0);
}
