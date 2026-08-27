// 中断された仕事を、次に開いた時に自分で続きから走らせる。
//
// **ブラウザのアプリは、閉じられたら本当に止まる。**
// サービスワーカーでも数十秒しか生きられないので、「閉じても裏で回り続ける」は
// Web では作れない。作れるのは次の3つで、ここは②を受け持つ。
//   ① 裏に回っても止まらない（画面を隠しただけなら走り続ける）
//   ② 止まってしまっても、次に開いた時に**続きから**再開する ← ここ
//   ③ 終わったら知らせる（lib/notify.js）
//
// AIを呼ばない。判定だけ。

/** 中断されたとみなす状態。 */
const RESUMABLE = ['queued', 'running'];

/**
 * 続きから走らせてよい仕事。
 *
 * 除くもの：
 *  ・保留（人が止めたもの）
 *  ・外へ出せない印が付いたもの
 *  ・承認待ち（人の判断が要る）
 *  ・やり残しの手順が無いもの
 */
export function interruptedTasks(tasks = []) {
  return tasks.filter((t) => {
    if (!t || !RESUMABLE.includes(t.status)) return false;
    if (t.holdReason) return false;
    if (t.flagged) return false;
    const steps = t.steps || [];
    if (!steps.length) return false;
    // まだ手を付けていない手順が残っていること
    return steps.some((s) => s.status === 'pending' || s.status === 'running');
  });
}

/**
 * 一度に再開する数。**まとめて走らせない**——
 * 何件も同時に走ると、開いた瞬間に費用が跳ね、どれが動いているか分からなくなる。
 */
export const RESUME_AT_ONCE = 1;

export function resumeTargets(tasks = [], { limit = RESUME_AT_ONCE } = {}) {
  return interruptedTasks(tasks)
    // 古いものから片付ける（新しいものを先にやると、古いものが永遠に残る）
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .slice(0, limit);
}

/**
 * 離れている間に終わった仕事。
 * @param {number} since 最後にアプリを見ていた時刻
 */
export function finishedWhileAway(tasks = [], since = 0, now = Date.now()) {
  if (!since) return [];
  return tasks
    .filter((t) => t.status === 'done' && (t.finishedAt || 0) > since && (t.finishedAt || 0) <= now)
    .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
}

/** 知らせの文言。1件と複数で言い方を変える（「1件の成果物」は不自然）。 */
export function doneMessage(tasks = []) {
  if (!tasks.length) return '';
  if (tasks.length === 1) return '成果物が完成しました！';
  return `成果物が${tasks.length}件 完成しました！`;
}

/** 経過（誰が・いつ・どれだけ）。画面で履歴として読める形にする。 */
export function progressOf(task) {
  const steps = (task && task.steps) || [];
  return steps.map((s) => ({
    id: s.id,
    who: s.employeeName || '未割り当て',
    roleId: s.roleId,
    kind: s.kind || 'work',
    status: s.status,
    startedAt: s.startedAt || null,
    finishedAt: s.finishedAt || null,
    // かかった時間（ミリ秒）。片方でも欠けていれば null（0秒と嘘をつかない）
    tookMs: s.startedAt && s.finishedAt ? s.finishedAt - s.startedAt : null,
    chars: (s.output || '').length,
    engine: s.providerName || '',
    model: s.model || '',
    cost: s.cost || 0,
    error: s.error || null,
  }));
}
