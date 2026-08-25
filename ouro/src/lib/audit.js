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
  employeeArchived: '社員を休職にした',
  approvalRequested: '承認を求めた',
  approvalGranted: '承認した',
  approvalDenied: '却下した',
  connectionChanged: '道具の接続を変えた',
  dealChanged: '案件を更新した',
  meetingHeld: '会議を開いた',
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

export function actionLabel(action) {
  return ACTIONS[action] || action;
}

/** 期間内のコスト合計（USD）。 */
export function totalCost(list = [], since = 0) {
  return list.filter((e) => e.at >= since).reduce((sum, e) => sum + (e.cost || 0), 0);
}
