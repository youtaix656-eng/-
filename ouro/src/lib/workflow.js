// Task / Workflow — 仕事の分割と、社員から社員への引き継ぎ。
//
// 単発の仕事でも必ず steps:[...] に入れる（あとで会議・並列化へ広げられるように）。
// ステップの出力は次のステップの input になる。これがハンドオフの実体。

import { newId } from './id.js';
import { planSteps, titleFor, detectNeeds } from './dispatcher.js';

export const TASK_STATUS = {
  draft: '下書き',
  queued: '待機中',
  running: '進行中',
  awaiting_approval: '承認待ち',
  done: '完了',
  failed: '失敗',
  cancelled: '中止',
};

export const STEP_STATUS = {
  pending: '待機',
  running: '実行中',
  done: '完了',
  failed: '失敗',
  skipped: '見送り',
};

/**
 * 依頼文から Task を組み立てる（実行はしない）。
 * @param {object} o
 * @param {string} o.request 自然言語の依頼
 * @param {string[]} [o.forceRoles] 役職を指定したいとき
 * @param {function} o.assign  (roleId) => employee|null  席の割り当て
 */
export function createTask({ request, forceRoles = null, maxSteps = 4, dealId = null, context = '', assign }) {
  const rawPlan = planSteps(request, { forceRoles, maxSteps });
  const needs = detectNeeds(request);

  // 誰も雇っていない役職が計画に入ると、その社員が見つからず仕事全体が失敗する。
  // 役職は25あり、ほとんどは未雇用なので、**在籍している役職だけで計画を組み直す**。
  // 外した役職は unstaffedRoles に残し、「雇えばもっと良くなる」と伝えられるようにする。
  const assigned = rawPlan.map((p, i) => ({ p, employee: assign ? assign(p.roleId, i) : null }));
  const staffed = assigned.filter((x) => x.employee);
  const unstaffedRoles = assigned.filter((x) => !x.employee).map((x) => x.p.roleId);
  // 1人も在籍していないときは絞り込めないので、元の計画のまま進める
  const chosen = staffed.length ? staffed : assigned;

  const steps = chosen.map(({ p, employee }, i) => {
    return {
      id: newId('step'),
      order: i,
      roleId: p.roleId,
      employeeId: employee ? employee.id : null,
      employeeName: employee ? employee.name : null,
      instruction: p.instruction,
      // 道具が要るのは最初の調査ステップだけ（毎ステップ検索するとコストが跳ねる）
      needs: i === 0 ? needs : [],
      status: 'pending',
      input: '',
      output: '',
      providerId: null,
      model: null,
      usage: null,
      cost: 0,
      citations: [],
      startedAt: null,
      finishedAt: null,
      error: null,
    };
  });

  return {
    id: newId('task'),
    title: titleFor(request),
    request: String(request || ''),
    context: String(context || ''),
    status: 'queued',
    steps,
    currentStep: 0,
    dealId,
    unstaffedRoles, // 向いているが未雇用だった役職
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    result: { text: '', knowledgeIds: [], sourceIds: [] },
    totalCost: 0,
  };
}

/** 次に実行すべきステップ。 */
export function nextStep(task) {
  return (task.steps || []).find((s) => s.status === 'pending') || null;
}

/** ステップの結果を書き戻し、次のステップへ引き継ぐ。 */
export function applyStepResult(task, stepId, result) {
  const steps = task.steps.map((s) => {
    if (s.id !== stepId) return s;
    return {
      ...s,
      status: result.error ? 'failed' : 'done',
      output: result.text || '',
      providerId: result.providerId || null,
      providerName: result.providerName || null,
      model: result.model || null,
      reason: result.reason || '',
      offline: Boolean(result.offline),
      usage: result.usage || null,
      cost: result.cost || 0,
      citations: result.citations || [],
      usedKnowledgeIds: result.usedKnowledgeIds || [],
      finishedAt: Date.now(),
      error: result.error || null,
    };
  });

  // 次のステップへ引き継ぐ
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx >= 0 && idx + 1 < steps.length && !result.error) {
    steps[idx + 1] = { ...steps[idx + 1], input: result.text || '' };
  }

  const failed = steps.some((s) => s.status === 'failed');
  const allDone = steps.every((s) => s.status === 'done' || s.status === 'skipped');

  return {
    ...task,
    steps,
    currentStep: Math.min(idx + 1, steps.length - 1),
    status: failed ? 'failed' : allDone ? 'done' : 'running',
    startedAt: task.startedAt || Date.now(),
    finishedAt: allDone || failed ? Date.now() : null,
    totalCost: steps.reduce((sum, s) => sum + (s.cost || 0), 0),
    result: allDone
      ? {
          ...task.result,
          text: lastOutput(steps),
        }
      : task.result,
  };
}

function lastOutput(steps) {
  const done = steps.filter((s) => s.status === 'done' && s.output);
  return done.length ? done[done.length - 1].output : '';
}

/** 全ステップの出力をつなげた「会社としての提出物」。 */
export function assembleResult(task) {
  const parts = [];
  for (const s of task.steps || []) {
    if (s.status !== 'done' || !s.output) continue;
    parts.push(`## ${s.employeeName || s.roleId}\n\n${s.output}`);
  }
  return parts.join('\n\n---\n\n');
}

export function taskProgress(task) {
  const steps = task.steps || [];
  if (!steps.length) return 0;
  const done = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  return Math.round((done / steps.length) * 100);
}
