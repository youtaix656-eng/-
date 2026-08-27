// 事業（ベンチャー）——「1件の仕事」ではなく「1つの事業」を持つ器。
//
// Ouro はこれまで仕事・案件・知識・収益導線を**全部ひとまとめ**で持っていた。
// 2つめの事業を始めた瞬間に数字が混ざり、「どっちが伸びているのか」が
// 見えなくなる（案件は1件いくらの記録、収益導線は人の減り方、で層が違う）。
//
// 決まりごと：
//  ・**結びつきは片方向だけ。** 仕事の `task.ventureId`／案件の `deal.ventureId` で数え、
//    事業の側に taskIds を持たない（`deal.taskIds` が誰にも更新されず
//    AI費用が常に0円に見えていた、あの失敗を繰り返さない）。
//  ・**「実行中」は1つだけ。**（選択と集中。増やしたくなったら休止と入れ替える）
//  ・**業界平均のような手元に無い基準を持たない。**（収益導線と同じ）
//  ・AIを呼ばない。全部その場の計算で出す。

import { newId } from './id.js';
import { dealAiCost, EARNED_STATUS, PIPELINE_STATUS } from './revenue.js';
import { normalizeRisks } from './risk.js';

export const VENTURE_STATES = {
  idea: '検討中',
  running: '実行中',
  paused: '休止',
  stopped: '撤退',
  keep: '続ける',
};

/** 「実行中」にできる数。選択と集中を気合いではなく型で持つ。 */
export const ACTIVE_LIMIT = 1;

/** 事業の期間の既定（日）。動画の「10日フルコミット」より少し長い30日。 */
export const DEFAULT_DAYS = 30;

const DAY = 86400000;

export function makeVenture(data = {}) {
  const now = Date.now();
  const state = VENTURE_STATES[data.state] ? data.state : 'idea';
  return {
    id: data.id || newId('vt'),
    title: String(data.title || '無題の事業').slice(0, 80),
    // 仮説（何が当たると思っているか）。あとで外れたと分かることが大事なので、必ず1行残す。
    hypothesis: String(data.hypothesis || '').slice(0, 300),
    who: String(data.who || '').slice(0, 120),   // 誰に
    what: String(data.what || '').slice(0, 120), // 何を
    priceJpy: num(data.priceJpy),
    goalMonthlyJpy: num(data.goalMonthlyJpy),
    days: num(data.days) || DEFAULT_DAYS,
    state,
    startedAt: data.startedAt || (state === 'running' ? now : null),
    // 撤退・継続の基準。**始める前に書く**（惰性で続けないため）
    verdict: normalizeVerdict(data.verdict),
    // 続くかどうかの見立て（真似される・場所に止められる…）。採点はしない。
    risks: normalizeRisks(data.risks),
    // 仕上げ線＝「ここまで出来たら手を止める」。伸びた時に増やし続けないための1行。
    finishWhen: String(data.finishWhen || '').slice(0, 120),
    restedAt: Number(data.restedAt) || 0,
    notes: String(data.notes || '').slice(0, 1000),
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

/** 撤退・継続の基準。metric は収益導線の段 id。 */
export function normalizeVerdict(v) {
  const base = { metric: 'lead', target: 0, decidedAt: 0, decision: '' };
  if (!v || typeof v !== 'object') return base;
  return {
    metric: typeof v.metric === 'string' ? v.metric : base.metric,
    target: num(v.target),
    decidedAt: Number(v.decidedAt) || 0,
    decision: typeof v.decision === 'string' ? v.decision : '',
  };
}

export function normalizeVenture(v) {
  if (!v || !v.id) return null;
  return { ...makeVenture(v), id: v.id, createdAt: v.createdAt || Date.now(), updatedAt: v.updatedAt || Date.now() };
}

export function ventureById(ventures = [], id) {
  return ventures.find((v) => v.id === id) || null;
}

/** いま実行中の事業（無ければ null）。 */
export function activeVenture(ventures = []) {
  return ventures.find((v) => v.state === 'running') || null;
}

/**
 * 「実行中」にしてよいか。
 * すでに別の事業が実行中なら止める——止めるだけで、勝手に入れ替えない
 * （どちらを休止にするかは人が決めること）。
 */
export function canStart(ventures = [], id) {
  const others = ventures.filter((v) => v.id !== id && v.state === 'running');
  if (others.length < ACTIVE_LIMIT) return { ok: true, blocker: null };
  return { ok: false, blocker: others[0] };
}

/** 開始から何日目か（1日目から数える）。始まっていなければ 0。 */
export function dayIndex(venture, now = Date.now()) {
  if (!venture || !venture.startedAt) return 0;
  return Math.floor((now - venture.startedAt) / DAY) + 1;
}

/** 期間の残り日数（マイナスは超過）。 */
export function daysLeft(venture, now = Date.now()) {
  if (!venture || !venture.startedAt) return null;
  return (venture.days || DEFAULT_DAYS) - dayIndex(venture, now) + 1;
}

/**
 * この事業の数字。**仕事と案件の側から数える**（事業の側に一覧を持たない）。
 */
export function ventureStats({ venture, tasks = [], deals = [], knowledge = [], posts = [], usdJpy = 155, now = Date.now() } = {}) {
  if (!venture) return null;
  const myTasks = tasks.filter((t) => t.ventureId === venture.id);
  const myDeals = deals.filter((d) => d.ventureId === venture.id);
  const myPosts = posts.filter((p) => p.ventureId === venture.id);

  const earned = myDeals.filter((d) => EARNED_STATUS.includes(d.status)).reduce((s, d) => s + (d.fee || 0), 0);
  const expected = myDeals.filter((d) => PIPELINE_STATUS.includes(d.status)).reduce((s, d) => s + (d.fee || 0), 0);
  // 案件に紐づかない仕事のAI費用も、この事業のコストとして数える
  const dealCost = myDeals.reduce((s, d) => s + dealAiCost(d, tasks, usdJpy), 0);
  const looseCost = myTasks
    .filter((t) => !t.dealId)
    .reduce((s, t) => s + (t.totalCost || 0), 0) * usdJpy;
  const aiCost = Math.round(dealCost + looseCost);

  const knowledgeIds = new Set(myTasks.flatMap((t) => (t.result && t.result.knowledgeIds) || []));

  return {
    taskCount: myTasks.length,
    doneCount: myTasks.filter((t) => t.status === 'done').length,
    dealCount: myDeals.length,
    postCount: myPosts.length,
    knowledgeCount: knowledge.filter((k) => knowledgeIds.has(k.id)).length,
    earned,
    expected,
    aiCost,
    net: Math.round(earned - aiCost),
    dayIndex: dayIndex(venture, now),
    daysLeft: daysLeft(venture, now),
  };
}

/** 一覧の並び：実行中 → 検討中 → 休止 → 続ける → 撤退。同じ状態なら新しい順。 */
const ORDER = { running: 0, idea: 1, paused: 2, keep: 3, stopped: 4 };
export function sortVentures(ventures = []) {
  return [...ventures].sort((a, b) => {
    const d = (ORDER[a.state] ?? 9) - (ORDER[b.state] ?? 9);
    return d !== 0 ? d : (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}
