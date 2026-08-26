// Task / Workflow — 仕事の分割と、社員から社員への引き継ぎ。
//
// 単発の仕事でも必ず steps:[...] に入れる（あとで会議・並列化へ広げられるように）。
// ステップの出力は次のステップの input になる。これがハンドオフの実体。

import { newId } from './id.js';
import { planSteps, titleFor, detectNeeds } from './dispatcher.js';
import { roleById } from '../data/roles.js';

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
 * 応答が空だったか（新規）。
 *
 * エラーは出ていないのに本文が空、という結果がある（モデルが何も返さない等）。
 * これを「完了」にすると、提出物ゼロ・知識ゼロのまま
 * 画面に「完了」とだけ出て、何が起きたのか分からなくなる。
 * 空白だけを空とみなす（「該当なし」のような短い正当な答えは通す）。
 */
export function isEmptyResult(result = {}) {
  return !result.error && !String(result.text || '').trim();
}

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
  // 役職は30あり、ほとんどは未雇用なので、**在籍している役職だけで計画を組み直す**。
  // 外した役職は unstaffedRoles に残し、「雇えばもっと良くなる」と伝えられるようにする。
  const assigned = rawPlan.map((p, i) => ({ p, employee: assign ? assign(p.roleId, i) : null }));
  const staffed = assigned.filter((x) => x.employee);
  const unstaffedRoles = assigned.filter((x) => !x.employee).map((x) => x.p.roleId);
  // 承認役が未雇用のまま外れると「確認を通していない成果物」が出てしまう。
  // 黙って落とさず、画面で分かるように控えておく。
  const missingApprovers = unstaffedRoles.filter((r) => roleById(r)?.isApprover);
  // 1人も在籍していないときは絞り込めないので、元の計画のまま進める
  const chosen = staffed.length ? staffed : assigned;

  const steps = chosen.map(({ p, employee }, i) => {
    return {
      id: newId('step'),
      order: i,
      // 新項目22：同じ group の手順は同時に走る。指定が無ければ1手順=1group（＝順番どおり）。
      group: Number.isInteger(p.group) ? p.group : i,
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
    missingApprovers, // そのうち「承認役」だったもの（確認を通せていない印）
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    // 本文はここに持たない（手順の出力と知識の body にある）。参照だけを残す。
    result: { knowledgeIds: [], sourceIds: [] },
    totalCost: 0,
  };
}

/** 次に実行すべきステップ。 */
export function nextStep(task) {
  return (task.steps || []).find((s) => s.status === 'pending') || null;
}

/**
 * 次に実行すべき手順の**かたまり**（新項目22）。
 * 同じ group の待機中の手順をまとめて返す。前の group が終わるまで先へ進まない。
 * 指定が無い仕事では、必ず1件だけの配列になる（従来と同じ動き）。
 */
export function nextGroup(task) {
  const steps = task.steps || [];
  const first = steps.find((s) => s.status === 'pending');
  if (!first) return [];
  const g = groupOf(first, steps);
  // 前の group にまだ終わっていない手順があるなら、そこが先
  const earlier = steps.filter((s) => groupOf(s, steps) < g);
  if (earlier.some((s) => s.status === 'pending' || s.status === 'running')) return [];
  return steps.filter((s) => s.status === 'pending' && groupOf(s, steps) === g);
}

function groupOf(step, steps) {
  return Number.isInteger(step.group) ? step.group : steps.indexOf(step);
}

/** ステップの結果を書き戻し、次のステップへ引き継ぐ。 */
export function applyStepResult(task, stepId, result) {
  const steps = task.steps.map((s) => {
    if (s.id !== stepId) return s;
    const empty = isEmptyResult(result);
    return {
      ...s,
      status: result.error || empty ? 'failed' : 'done',
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
      error: result.error || (empty ? 'AIから空の応答が返りました' : null),
    };
  });

  // 次のステップへ引き継ぐ。
  // 新項目22：同時に走る手順があるので、**その group が全部終わってから**
  // 次の group へ渡す。1つ終わるたびに渡すと、片方の結果しか届かない。
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx >= 0 && !result.error && !isEmptyResult(result)) {
    const g = groupOf(steps[idx], steps);
    const sameGroup = steps.filter((s) => groupOf(s, steps) === g);
    const groupDone = sameGroup.every((s) => s.status === 'done' || s.status === 'skipped');
    if (groupDone) {
      const handoff = sameGroup
        .filter((s) => s.output)
        .map((s) => (sameGroup.length > 1 ? `## ${s.employeeName || s.roleId}\n\n${s.output}` : s.output))
        .join('\n\n---\n\n');
      // **「g + 1」で探さないこと。** 未雇用の役職を計画から外すと group の番号が
      // 飛ぶ（例：0, 2）ので、+1 では次の手順が見つからず引き継ぎが空になる。
      // 実際に残っている番号の中から「g より大きい最小」を探す。
      const nextG = steps
        .map((x) => groupOf(x, steps))
        .filter((n) => n > g)
        .sort((a, b) => a - b)[0];
      if (nextG !== undefined) {
        for (let i = 0; i < steps.length; i += 1) {
          if (groupOf(steps[i], steps) === nextG) steps[i] = { ...steps[i], input: handoff };
        }
      }
    }
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
    // **提出物の本文をここに持たせない。**
    // 同じ文章を steps（各手順の出力）と result.text と知識の body の
    // 3か所に持っていたため、仕事1件あたりの保存量が実際の3倍になっていた。
    // 本文が要る所では assembleResult(task) で組み立てる。
    result: task.result,
  };
}

/**
 * 失敗した手順を待機に戻して、そこからやり直せる形にする（新規）。
 *
 * これまでは1手順でも失敗すると task.status が failed で固まり、
 * 画面には「続きを実行する」が出るのに runTask が即座に抜けるため、
 * 押しても何も起きない行き止まりになっていた。
 *
 * @param {string} [stepId] 指定するとその手順だけ。省略すると失敗した全手順。
 */
export function retryFailed(task, stepId = null) {
  const steps = (task.steps || []).map((s) => {
    if (s.status !== 'failed') return s;
    if (stepId && s.id !== stepId) return s;
    return { ...s, status: 'pending', output: '', error: null, startedAt: null, finishedAt: null };
  });
  const changed = steps.some((s, i) => s !== task.steps[i]);
  if (!changed) return task;
  return {
    ...task,
    steps,
    status: 'queued',
    finishedAt: null,
  };
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
