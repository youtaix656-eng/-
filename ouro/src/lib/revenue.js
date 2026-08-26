// 案件（Deal）と収益。
//
// 仕様書には無い層だが、「AI社員に働いてもらって実際にお金にする」ために足した。
// AI社員の成果物を案件に紐づけ、売上・見込み・かかったAI費用・時給換算を出す。
// 数字は端末内だけで計算する（外部に送らない）。

import { newId } from './id.js';

export const DEAL_STATUS = {
  lead: '見込み',
  proposed: '提案中',
  active: '作業中',
  delivered: '納品済み',
  paid: '入金済み',
  lost: '見送り',
};

// 売上として数えるもの／見込みとして数えるもの
export const EARNED_STATUS = ['paid'];
export const PIPELINE_STATUS = ['lead', 'proposed', 'active', 'delivered'];

export function createDeal(data = {}) {
  return {
    id: newId('deal'),
    title: String(data.title || '無題の案件').slice(0, 100),
    client: String(data.client || ''),
    templateId: data.templateId || null,
    fee: Number(data.fee) || 0,
    currency: data.currency || 'JPY',
    status: DEAL_STATUS[data.status] ? data.status : 'lead',
    dueAt: data.dueAt || null,
    hoursSpent: Number(data.hoursSpent) || 0,
    taskIds: data.taskIds || [],
    knowledgeIds: data.knowledgeIds || [],
    notes: String(data.notes || ''),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    paidAt: data.status === 'paid' ? Date.now() : null,
  };
}

/** 案件にかかった AI 費用（円換算）。 */
export function dealAiCost(deal, tasks = [], usdJpy = 155) {
  const ids = new Set(deal.taskIds || []);
  const usd = tasks.filter((t) => ids.has(t.id)).reduce((s, t) => s + (t.totalCost || 0), 0);
  return usd * usdJpy;
}

/**
 * 収益サマリー。
 * @param {object[]} deals
 * @param {object[]} tasks
 * @param {object} opts { since, usdJpy }
 */
export function revenueSummary(deals = [], tasks = [], opts = {}) {
  const { since = 0, usdJpy = 155 } = opts;
  const inRange = (d) => (d.paidAt || d.updatedAt || d.createdAt) >= since;

  const paid = deals.filter((d) => EARNED_STATUS.includes(d.status) && inRange(d));
  const pipeline = deals.filter((d) => PIPELINE_STATUS.includes(d.status));

  const earned = paid.reduce((s, d) => s + (d.fee || 0), 0);
  const expected = pipeline.reduce((s, d) => s + (d.fee || 0), 0);
  const aiCost = deals.reduce((s, d) => s + dealAiCost(d, tasks, usdJpy), 0);
  const hours = paid.reduce((s, d) => s + (d.hoursSpent || 0), 0);

  return {
    earned,
    expected,
    aiCost: Math.round(aiCost),
    profit: Math.round(earned - aiCost),
    hours,
    hourlyRate: hours > 0 ? Math.round((earned - aiCost) / hours) : null,
    paidCount: paid.length,
    pipelineCount: pipeline.length,
    // AI費用1円あたり何円になったか。1未満なら赤字。
    returnRatio: aiCost > 0 ? Number((earned / aiCost).toFixed(1)) : null,
  };
}

/** 締切が近い順（納品前のものだけ）。 */
export function upcomingDeals(deals = [], now = Date.now()) {
  return deals
    .filter((d) => d.dueAt && !['paid', 'lost'].includes(d.status))
    .sort((a, b) => a.dueAt - b.dueAt)
    .map((d) => ({ ...d, daysLeft: Math.ceil((d.dueAt - now) / 86400000) }));
}

export function formatMoney(n, currency = 'JPY') {
  const v = Math.round(Number(n) || 0);
  if (currency === 'JPY') return `${v.toLocaleString('ja-JP')}円`;
  return `${currency} ${v.toLocaleString()}`;
}
