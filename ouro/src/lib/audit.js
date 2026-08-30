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
  // 台帳・ルール・導線・チーム（あとから足したもの）
  taskHeld: '保留にした',
  taskResumed: '保留を解いた',
  taskRetried: 'やり直した',
  decisionApproved: '判断した（進める）',
  decisionRejected: '判断した（見送る）',
  employeeTaught: '社員に覚えさせた',
  ruleAdded: '会社のルールを足した',
  funnelEntry: '導線の数字を入れた',
  standupHeld: '朝会を開いた',
  consultAnswered: '相談に答えた',
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

/**
 * 追記する。上限を超えたら **古い方を落とすのではなく畳む**。
 *
 * 以前は超えた分を slice で捨てていた。畳む処理（foldAudit）は
 * 「30日より古いもの」しか対象にしないので、30日以内に上限へ達すると
 * 記録が畳まれる前に消えていた——「消すのではなく畳む」という約束と矛盾する。
 * ここでは日付に関係なく、古い方から**日ごとにまとめて**枠を空ける。
 * まとめた件数と費用は残るので、「いつ何件動かして、いくらかかったか」は失われない。
 */
export function appendAudit(list = [], entry, { fold = true } = {}) {
  const next = [...list, entry];
  if (next.length <= AUDIT_LIMIT) return next;

  // **全件を手元に持っていない時は畳まない。**
  // 一部だけ読み込んでいる間はディスクのレコードを消さない決まりなので、
  // ここで畳むと「まとめ」と「畳んだ元」が両方ディスクに残り、費用が二重に数えられる。
  // 手元の配列から古い分を外すだけにする（ディスクには残っているので失われない）。
  if (!fold) return next.slice(next.length - AUDIT_LIMIT);

  // 古い方の3割を畳んで枠を作る（毎回1件ずつ畳むと、そのたびに走って重い）
  const foldCount = Math.max(1, Math.floor(AUDIT_LIMIT * 0.3));
  const old = next.slice(0, foldCount);
  const keep = next.slice(foldCount);
  const { list: folded } = foldAudit(old, { now: Date.now(), olderThan: 0 });
  const merged = [...folded, ...keep];

  // 畳んでも入りきらない時だけ、やむを得ず古い方を落とす
  return merged.length > AUDIT_LIMIT ? merged.slice(merged.length - AUDIT_LIMIT) : merged;
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
      // **日付だけの id にしないこと。** 上限に達するたびに畳むので、
      // 同じ日の「まとめ」が何度もできる。id が重なると、
      // 読み直しの突き合わせで片方が落ちたり、一覧の key が重複する。
      id: `fold_${day}_${v.at}_${v.count}`,
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
