// 仕事台帳（Ledger）。全部の仕事を1枚で見る（新規）。
//
// 元にした考え方：AI社員を増やしても、受け渡しの形を決めないとチームにならない。
// 受付番号・状態・担当・期限・次の対応を1か所に集めた台帳が「共通記憶」になる。
//
// **ただし台帳は手で更新しない。** 表計算の台帳は人が更新する前提だが、
// Ouro は仕事が実際に走る場所なので、同じ設計にすると更新漏れで台帳が嘘をつく。
// 台帳は仕事から毎回導く**ビュー**とし、人が持つのは次の3つだけ：
//   期限（dueAt）／次の対応（nextAction）／保留の理由（holdReason）
// この3つは仕事の側（task）に置く。台帳が別の表を持つと、
// 案件の taskIds で起きた「誰も更新しない列」が再発する。

import { openDecisions } from './decisions.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

// 台帳での状態。仕事の status から導く（status を増やさずに済むものは畳む）。
export const LEDGER_STATES = [
  { id: 'todo', name: '未着手', glyph: '□', order: 1 },
  { id: 'doing', name: '作業中', glyph: '▶', order: 2 },
  { id: 'waiting', name: '確認待ち', glyph: '⚖', order: 3 },
  { id: 'hold', name: '保留', glyph: '‖', order: 4 },
  { id: 'stopped', name: '止まっている', glyph: '⚠', order: 5 },
  { id: 'done', name: '完了', glyph: '✓', order: 6 },
  { id: 'cancelled', name: '中止', glyph: '×', order: 7 },
];

export function ledgerState(id) {
  return LEDGER_STATES.find((s) => s.id === id) || LEDGER_STATES[0];
}

export function ledgerStateOf(task) {
  switch (task.status) {
    case 'running':
      return 'doing';
    case 'awaiting_approval':
      return 'waiting';
    case 'on_hold':
      return 'hold';
    case 'failed':
      return 'stopped';
    case 'cancelled':
      return 'cancelled';
    case 'done':
      // 完了でも、人間の判断が残っているなら「確認待ち」。
      // 完了だけを見て終わったつもりになるのを防ぐ。
      return openDecisions(task).length ? 'waiting' : 'done';
    default:
      return 'todo';
  }
}

/**
 * 受付番号。**別に採番の表を持たない**（持つと台帳が第2の正になる）。
 * 受け付けた日と、仕事の id の末尾から毎回同じ番号を作る。
 */
export function ticketOf(task) {
  const d = new Date(task.createdAt || 0);
  const ymd = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
  const tail = String(task.id || '').replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase().padStart(4, '0');
  return `OU-${ymd}-${tail}`;
}

/** 期限の状態。期限が無いものは 'none'（急かさない）。 */
export function dueStateOf(dueAt, now = Date.now()) {
  if (!dueAt) return 'none';
  const today = startOfDay(now);
  const day = startOfDay(dueAt);
  if (day < today) return 'overdue';
  if (day === today) return 'today';
  if (day <= today + 3 * DAY_MS) return 'soon';
  return 'later';
}

export const DUE_LABELS = {
  overdue: '期限切れ',
  today: '今日まで',
  soon: 'まもなく',
  later: '',
  none: '',
};

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 担当（誰が動いたか／次に動くのは誰か）。 */
export function ownerOf(task) {
  const steps = task.steps || [];
  const running = steps.find((s) => s.status === 'running');
  const pending = steps.find((s) => s.status === 'pending');
  const last = [...steps].reverse().find((s) => s.status === 'done');
  const s = running || pending || last;
  return s ? s.employeeName || s.roleId || '' : '';
}

/**
 * 台帳の1行。記事の10項目をそのまま列にする。
 * @param {object} task
 * @param {{deals?:object[], now?:number}} ctx
 */
export function ledgerRow(task, { deals = [], now = Date.now() } = {}) {
  const state = ledgerStateOf(task);
  const deal = task.dealId ? deals.find((d) => d.id === task.dealId) : null;
  const decisions = openDecisions(task);
  // 期限は仕事に入っていればそれ。無ければ案件の締切を引き継ぐ（複製はしない）。
  const dueAt = task.dueAt || (deal ? deal.dueAt : null) || null;
  return {
    id: task.id,
    ticket: ticketOf(task),
    createdAt: task.createdAt || 0,
    title: task.title || '',
    request: task.request || '',
    owner: ownerOf(task),
    state,
    stateName: ledgerState(state).name,
    dueAt,
    dueFromDeal: Boolean(!task.dueAt && deal && deal.dueAt),
    dueState: dueStateOf(dueAt, now),
    dealId: task.dealId || null,
    dealTitle: deal ? deal.title : '',
    decisions: decisions.length,
    nextAction: task.nextAction || defaultNextAction(task, state, decisions.length),
    holdReason: task.holdReason || '',
    knowledgeIds: (task.result && task.result.knowledgeIds) || [],
    cost: task.totalCost || 0,
    updatedAt: task.finishedAt || task.startedAt || task.createdAt || 0,
  };
}

/** 「次に誰が何をするか」が書かれていない時の既定文（推測はしない・事実だけ）。 */
function defaultNextAction(task, state, decisionCount) {
  if (state === 'waiting' && decisionCount) return `あなたの判断が${decisionCount}件`;
  if (state === 'waiting') return 'あなたの承認待ち';
  if (state === 'stopped') return '失敗した所からやり直す';
  if (state === 'hold') return '再開する時期を決める';
  if (state === 'todo') return `${ownerOf(task) || '担当'}が着手`;
  if (state === 'doing') return `${ownerOf(task) || '担当'}が作業中`;
  return '';
}

export function buildLedger(tasks = [], ctx = {}) {
  return sortLedger(tasks.map((t) => ledgerRow(t, ctx)));
}

/**
 * 並び：手当てが要るものが上。
 * 期限切れ → 今日 → 判断待ち → まもなく → その他（新しい順）。
 */
const URGENCY = { overdue: 0, today: 1, soon: 3, later: 4, none: 5 };

export function sortLedger(rows = []) {
  const closed = (r) => (r.state === 'done' || r.state === 'cancelled' ? 1 : 0);
  return [...rows].sort((a, b) => {
    if (closed(a) !== closed(b)) return closed(a) - closed(b);
    const ua = a.decisions && URGENCY[a.dueState] > 2 ? 2 : URGENCY[a.dueState];
    const ub = b.decisions && URGENCY[b.dueState] > 2 ? 2 : URGENCY[b.dueState];
    if (ua !== ub) return ua - ub;
    return b.updatedAt - a.updatedAt;
  });
}

/**
 * 絞り込み。台帳のフィルタは**ここだけ**（画面ごとに書かない）。
 * @param {object[]} rows
 * @param {{state?:string, due?:string, decisionsOnly?:boolean, dealId?:string, q?:string}} f
 */
export function filterLedger(rows = [], f = {}) {
  const q = String(f.q || '').trim().toLowerCase();
  return rows.filter((r) => {
    if (f.state && r.state !== f.state) return false;
    if (f.due === 'overdue' && r.dueState !== 'overdue') return false;
    if (f.due === 'today' && !['overdue', 'today'].includes(r.dueState)) return false;
    if (f.due === 'week' && !['overdue', 'today', 'soon'].includes(r.dueState)) return false;
    if (f.decisionsOnly && !r.decisions) return false;
    if (f.dealId && r.dealId !== f.dealId) return false;
    if (f.openOnly && (r.state === 'done' || r.state === 'cancelled')) return false;
    if (q) {
      const hay = `${r.ticket} ${r.title} ${r.request} ${r.owner} ${r.dealTitle} ${r.nextAction}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * 「今日やること」。記事の
 * 「期限を過ぎている案件・判断待ち・今日中に対応すべき案件」をそのまま。
 */
export function todayFocus(rows = []) {
  const overdue = rows.filter((r) => r.dueState === 'overdue' && r.state !== 'done' && r.state !== 'cancelled');
  const today = rows.filter((r) => r.dueState === 'today' && r.state !== 'done' && r.state !== 'cancelled');
  const decisions = rows.filter((r) => r.decisions > 0);
  const stopped = rows.filter((r) => r.state === 'stopped');
  return { overdue, today, decisions, stopped, total: overdue.length + today.length + decisions.length + stopped.length };
}
