// Task / Workflow — 仕事の分割と、社員から社員への引き継ぎ。
//
// 単発の仕事でも必ず steps:[...] に入れる（あとで会議・並列化へ広げられるように）。
// ステップの出力は次のステップの input になる。これがハンドオフの実体。

import { newId } from './id.js';
import { planSteps, titleFor, detectNeeds } from './dispatcher.js';
import { roleById } from '../data/roles.js';
import { buildHandoff } from './handoff.js';
import { parseChecklist, checkInstruction } from './checks.js';

export const TASK_STATUS = {
  draft: '下書き',
  queued: '待機中',
  running: '進行中',
  awaiting_approval: '承認待ち',
  on_hold: '保留',
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
export function createTask({
  request,
  forceRoles = null,
  maxSteps = 4,
  dealId = null,
  // 事業（1つの事業の器）。**結びつきはこの片方向だけ**
  // （事業の側に taskIds を持たない。持つと誰も更新しない列になる）。
  ventureId = null,
  context = '',
  assign,
  // 受付のときに決まっていることがあれば預かる（全部あとから足せる）。
  dueAt = null,
  deliverableSpec = '',
  doneWhen = '',
  materials = '',
  constraints = '',
}) {
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

  // 完成条件が書かれていたら、**最後にそれを1つずつ確かめる手順**を足す。
  // 承認と同じ理由で maxSteps では切り落とさない
  //（「上限に達したので完成の確認を省いた」が起きてはいけない）。
  const checkItems = parseChecklist(doneWhen);
  const checker = checkItems.length && assign ? assign('reviewer', chosen.length) : null;
  const withCheck = checker
    ? [...chosen, { p: { roleId: 'reviewer', instruction: checkInstruction(checkItems), kind: 'check' }, employee: checker }]
    : chosen;

  // 確認の手順は**必ず単独で最後**。番号を i（並び順）にすると、
  // 前の手順と同じ番号になって「同時に走る」扱いになり、
  // まだ出来ていない成果物を確認してしまう（未雇用の役職を外すと番号が飛ぶため）。
  const planGroups = chosen.map(({ p }, i) => (Number.isInteger(p.group) ? p.group : i));
  const checkGroup = planGroups.length ? Math.max(...planGroups) + 1 : 0;

  const steps = withCheck.map(({ p, employee }, i) => {
    return {
      id: newId('step'),
      order: i,
      // 新項目22：同じ group の手順は同時に走る。指定が無ければ1手順=1group（＝順番どおり）。
      group: p.kind === 'check' ? checkGroup : Number.isInteger(p.group) ? p.group : i,
      roleId: p.roleId,
      employeeId: employee ? employee.id : null,
      employeeName: employee ? employee.name : null,
      instruction: p.instruction,
      // 'check' は完成条件を確かめるだけの手順。提出物ではないので、
      // 回答の枠（5項目）も掛けないし、提出物にも混ぜない。
      kind: p.kind || 'work',
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
    ventureId,
    // ── 台帳の3列。ここだけは人が手で持つ（lib/ledger.js のコメント参照） ──
    dueAt: dueAt || null,
    nextAction: '',
    holdReason: '',
    // 受付のときに決めた条件（空でも動く。あとから足せる）
    spec: { deliverable: String(deliverableSpec || ''), doneWhen: String(doneWhen || ''), materials: String(materials || ''), constraints: String(constraints || '') },
    // 成果物から拾った「あなたの判断が要ること」（完了時に1度だけ作る）
    decisions: [],
    // 完成条件は書かれているのに、確かめる担当（レビュアー）が未雇用だった
    checkUnstaffed: Boolean(checkItems.length && !checker),
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
export function applyStepResult(task, stepId, result, handoffMode = 'compact') {
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
      // 引き継ぎは「次の担当が続きをやるために要るもの」だけにする（lib/handoff.js）。
      // 枠に沿っていない出力はそのまま全部渡すので、材料が消えることはない。
      const handoff = buildHandoff(sameGroup, handoffMode);
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

  // **実行中に保留にされた仕事を、勝手に running へ戻さない。**
  // 戻すと runTask のループが「動かしてよい」と判断して残りの手順まで走り、
  // 止めたはずなのにAIの利用料がかかる。
  const held = task.status === 'on_hold' && !failed && !allDone;

  return {
    ...task,
    steps,
    currentStep: Math.min(idx + 1, steps.length - 1),
    status: held ? 'on_hold' : failed ? 'failed' : allDone ? 'done' : 'running',
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
    if (s.kind === 'check') continue; // 完成の確認は別に見せる
    parts.push(`## ${s.employeeName || s.roleId}\n\n${s.output}`);
  }
  return parts.join('\n\n---\n\n');
}

/**
 * 会社としての提出物を書いた手順の出力（＝5項目の枠が掛かっている本文）。
 *
 * **判断や見出しを assembleResult から拾ってはいけない。**
 * あれは全手順の出力を「## 担当者名」で連ねたものなので、
 * 見出しを探すと途中の手順の「まとめ」や担当者名を拾ってしまい、
 * 本物の「あなたの判断が要ること」が見つからなくなる（実際に起きた）。
 */
export function finalOutput(task) {
  const steps = (task && task.steps) || [];
  // 完成の確認は提出物ではない（○×の並びなので、ここから見出しを探さない）
  const done = steps.filter((s) => s.status === 'done' && s.output && s.kind !== 'check');
  if (!done.length) return '';
  const g = (x) => (Number.isInteger(x.group) ? x.group : steps.indexOf(x));
  let best = done[0];
  for (const s of done) if (g(s) >= g(best)) best = s;
  return best.output || '';
}

export function taskProgress(task) {
  const steps = task.steps || [];
  if (!steps.length) return 0;
  const done = steps.filter((s) => s.status === 'done' || s.status === 'skipped').length;
  return Math.round((done / steps.length) * 100);
}

/**
 * 保留にする（新規）。
 *
 * これまでは「今は寝かせる」と宣言する手段が無く、失敗した仕事が
 * failed のまま溜まっていくだけだった。保留は理由を必ず添える
 * （理由の無い保留は、あとで見た時に再開してよいか分からなくなる）。
 */
export function holdTask(task, reason = '') {
  if (!task || task.status === 'done' || task.status === 'cancelled') return task;
  return {
    ...task,
    status: 'on_hold',
    holdReason: String(reason || '').slice(0, 200),
    // 何の状態から保留にしたかを覚えておく。
    // 承認待ちだった仕事を queued に戻すと、承認がまだ残っているのに
    // 「続きを実行する」が押せてしまい、同じ仕事の承認が二重に並ぶ。
    heldFrom: task.status,
    heldAt: Date.now(),
  };
}

/** 保留を解いて、手順の状態から本来の状態へ戻す。 */
export function resumeTask(task) {
  if (!task || task.status !== 'on_hold') return task;
  const steps = task.steps || [];
  const failed = steps.some((s) => s.status === 'failed');
  const allDone = steps.length > 0 && steps.every((s) => s.status === 'done' || s.status === 'skipped');
  const started = steps.some((s) => s.status === 'done' || s.status === 'running');
  // 承認待ちから保留にしたものは、承認待ちへ戻す（承認はまだ残っている）
  const back = task.heldFrom === 'awaiting_approval' && !failed && !allDone ? 'awaiting_approval' : null;
  return {
    ...task,
    status: back || (failed ? 'failed' : allDone ? 'done' : started ? 'running' : 'queued'),
    holdReason: '',
    heldFrom: null,
    heldAt: null,
  };
}

/** 実行してよい状態か（保留・中止・完了は動かさない）。 */
export function isRunnable(task) {
  return Boolean(task) && !['on_hold', 'cancelled', 'done'].includes(task.status);
}

/**
 * その手順からやり直す（新規）。
 *
 * 引き継ぎの確認で「材料が足りなかった」と分かっても、その手順が既に終わっていると
 * 直しようがなかった。補った材料を活かすために、**その手順と、それより後**を
 * 待機に戻す（後ろの手順の入力は、この手順の出力から作られているため）。
 *
 * やり直す範囲ぶんのAI費用がもう一度かかるので、押す前に画面で件数を伝えること。
 */
/**
 * やり直しの上限（新規）。
 *
 * **際限のない差し戻しは、人間の職場でも典型的なパワハラの形**なので、
 * 型として持たない。3回やり直しているなら、指示の方に無理があるか、
 * ここは人が直した方が早い、というどちらかである可能性が高い。
 *
 * 止めはするが、行き止まりにはしない——「それでもやり直す」で必ず抜けられる
 * （抜けたら数え直す）。AI費用の歯止めにもなる。
 */
export const REDO_LIMIT = 3;

export function redoCountOf(task) {
  return Number((task && task.redoCount) || 0);
}

export function overRedoLimit(task) {
  return redoCountOf(task) >= REDO_LIMIT;
}

/** 「それでもやり直す」で数え直す。 */
export function resetRedoCount(task) {
  return { ...task, redoCount: 0 };
}

export function redoFrom(task, stepId) {
  const steps = task.steps || [];
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return task;
  const g = (x) => (Number.isInteger(x.group) ? x.group : steps.indexOf(x));
  const from = g(steps[idx]);
  const next = steps.map((s) =>
    g(s) >= from
      ? {
          ...s,
          status: 'pending',
          output: '',
          error: null,
          startedAt: null,
          finishedAt: null,
          // **cost は消さない。** 既に払ったぶんなので、消すと案件の
          // AI費用が実際より少なく見える（retryFailed も消していない）。
          citations: [],
        }
      : s
  );
  return {
    ...task,
    steps: next,
    status: 'queued',
    finishedAt: null,
    // 提出物が変わるので、拾い直すために判断は白紙に戻す
    decisions: [],
    // 何度やり直したか。上限を超えたら、続ける前に人が見る（REDO_LIMIT）。
    redoCount: redoCountOf(task) + 1,
    totalCost: next.reduce((sum, s) => sum + (s.cost || 0), 0),
  };
}

/**
 * 「この成果物は外へ出せない」と印を付ける（新規）。
 *
 * 印を付けたものは、知識にも掲示板にも入れない——
 * **加害的な文章を会社の共通記憶にしない**ため。
 * 仕事は保留になり、理由が残る。
 */
export const FLAG_HOLD_PREFIX = '外へ出せない内容として止めました：';

export function flagTask(task, reason = '') {
  if (!task) return task;
  return {
    ...task,
    flagged: { reason: String(reason || '').slice(0, 200), at: Date.now() },
    status: task.status === 'cancelled' ? task.status : 'on_hold',
    holdReason: `${FLAG_HOLD_PREFIX}${String(reason || '').slice(0, 120)}`,
    heldFrom: task.status,
    heldAt: Date.now(),
  };
}

/**
 * 印を外す。
 *
 * **保留も一緒に解く。** 印のせいで保留にしたのに印だけ外すと、
 * 「外へ出せない内容として止めました」という理由だけが残った保留になり、
 * 提出物の画面も出ないまま行き止まりになる（実際に踏んだ）。
 * 自分で付けた保留（別の理由）は触らない。
 */
export function unflagTask(task) {
  if (!task || !task.flagged) return task;
  const byFlag = task.status === 'on_hold' && String(task.holdReason || '').startsWith(FLAG_HOLD_PREFIX);
  if (!byFlag) return { ...task, flagged: null };
  return {
    ...task,
    flagged: null,
    status: task.heldFrom || 'done',
    holdReason: '',
    heldFrom: null,
    heldAt: null,
  };
}

export function isFlagged(task) {
  return Boolean(task && task.flagged && task.flagged.at);
}

/** その手順からやり直すと、いくつの手順が動くか（費用を伝えるため）。 */
export function redoCount(task, stepId) {
  const steps = task.steps || [];
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return 0;
  const g = (x) => (Number.isInteger(x.group) ? x.group : steps.indexOf(x));
  const from = g(steps[idx]);
  return steps.filter((s) => g(s) >= from).length;
}
