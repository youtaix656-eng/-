// 台帳と CSV のやりとり（新規）。
//
// **台帳の本体（lib/ledger.js）と分けてある。** ホームの「今日やること」は
// 起動直後に読まれるので、CSV の列や取り込みまで一緒に読ませない
// （起動時に読む量を増やさないため）。ここを使うのは台帳の画面だけ。

import { ticketOf } from './ledger.js';

/** CSV の列（書き出しと取り込みで同じ定義を使う）。 */
export const LEDGER_COLUMNS = [
  { key: 'ticket', name: '受付番号' },
  { key: 'createdText', name: '受付日' },
  { key: 'title', name: '依頼内容' },
  { key: 'owner', name: '担当AI' },
  { key: 'stateName', name: '進捗状況' },
  { key: 'dueText', name: '期限' },
  { key: 'deliverable', name: '成果物' },
  { key: 'decisionText', name: 'あなたの判断' },
  { key: 'nextAction', name: '次の対応' },
  { key: 'holdReason', name: '保留の理由' },
  { key: 'updatedText', name: '更新日' },
  { key: 'dealTitle', name: '案件' },
  { key: 'costText', name: 'AI費用(USD)' },
];

const ymd = (t) => (t ? new Date(t).toLocaleDateString('ja-JP') : '');

/** CSV に出す形へ（日付を文字にし、数字を丸める）。 */
export function csvRows(rows = []) {
  return rows.map((r) => ({
    ...r,
    createdText: ymd(r.createdAt),
    dueText: ymd(r.dueAt),
    updatedText: ymd(r.updatedAt),
    deliverable: r.knowledgeIds.length ? '知識として保存済み' : r.state === 'done' ? '提出物あり' : '',
    decisionText: r.decisions ? `${r.decisions}件` : '',
    costText: r.cost ? r.cost.toFixed(4) : '',
  }));
}

/**
 * CSV を読み込んで、台帳の「人が手で持つ列」だけを取り込む（新規）。
 *
 * **CSV から仕事は作らない。** 台帳は仕事から導くビューなので、
 * 表計算の行から仕事を生やすと、どちらが正か分からなくなる。
 * 受付番号で既にある仕事を探し、期限・次の対応・保留だけを書き換える。
 *
 * @returns {{ticket:string, taskId:string|null, dueAt:number|null, nextAction:string, hold:boolean, holdReason:string}[]}
 */
export function readLedgerCsv(objects = [], tasks = []) {
  const byTicket = new Map(tasks.map((t) => [ticketOf(t), t]));
  const out = [];
  for (const o of objects) {
    const ticket = String(o['受付番号'] || '').trim();
    if (!ticket) continue;
    const task = byTicket.get(ticket) || null;
    const dueText = String(o['期限'] || '').trim();
    const parsed = parseDateCell(dueText);
    const stateName = String(o['進捗状況'] || '').trim();
    out.push({
      ticket,
      taskId: task ? task.id : null,
      title: task ? task.title : String(o['依頼内容'] || ''),
      dueAt: parsed,
      // **読めなかった日付で、いまの期限を消さない。**
      // Excel が「2026年9月1日」に整形したり、手で「9/1」と書いたりするので、
      // 読めたときだけ書き換える（空欄も「触っていない」とみなす）。
      hasDue: parsed !== null,
      dueUnread: Boolean(dueText) && parsed === null,
      nextAction: String(o['次の対応'] || '').trim().slice(0, 120),
      hold: stateName === '保留',
      resume: Boolean(task) && task.status === 'on_hold' && stateName !== '' && stateName !== '保留',
      holdReason: String(o['保留の理由'] || '').trim().slice(0, 200),
    });
  }
  return out;
}

/**
 * 表計算から戻ってきた日付を読む。読めなければ null。
 * 受ける形：2026/9/1・2026-09-01・2026年9月1日・2026.9.1
 */
export function parseDateCell(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const m = /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const at = new Date(y, mo - 1, d);
  // 「2026/2/31」のような日付は弾く（月がずれるので分かる）
  if (at.getMonth() !== mo - 1 || at.getDate() !== d) return null;
  return at.getTime();
}
