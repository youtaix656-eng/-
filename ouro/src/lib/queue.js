// 待ち行列（新規）。**誰が誰を待っているか**。
//
// 在席ボード（lib/presence.js）は「その人がいま何をしているか」しか出さない。
// 知りたいのはもう一段先で、**誰のせいで他が止まっているか**——
// 「ルナ待ちが3件」が見えると、次に手を入れる場所が決まる。
//
// AIを1回も呼ばない（仕事の手順から導くだけ）。

/**
 * 待機中の手順が「誰の完了を待っているか」。
 *
 * 同じ番号（group）の手順は同時に走り、前の番号が全部終わるまで次へ進まない。
 * なので、待たせているのは**その手順より前の番号で、まだ終わっていない手順**。
 */
export function blockersOf(task) {
  const steps = task.steps || [];
  const g = (x) => (Number.isInteger(x.group) ? x.group : steps.indexOf(x));
  const first = steps.find((s) => s.status === 'pending');
  if (!first) return [];
  const target = g(first);
  return steps.filter((s) => g(s) < target && s.status !== 'done' && s.status !== 'skipped');
}

/**
 * その仕事が、いま誰（何）を待っているか。
 *
 * 手当てが要る順に見る：オーナー待ち → 実行中の担当 → まだ始めていない担当。
 * **「実行中」と「まだ始めていない」を混ぜないこと。**
 * 溜まっているのは後者で、そこが本当のボトルネック。
 */
export function waitingOn(task) {
  if (!task) return null;
  if (task.status === 'awaiting_approval') return { kind: 'owner', why: '承認' };
  if ((task.decisions || []).some((d) => d.state === 'open')) return { kind: 'owner', why: '判断' };
  if (task.status === 'on_hold') return { kind: 'owner', why: '保留の解除' };
  if (task.status === 'failed') return { kind: 'owner', why: 'やり直しの指示' };

  // ここから先は「社員の番」の話。**終わった仕事はもう誰も待っていない。**
  // （やり残しの手順が残っていても、仕事としては終わっている）
  if (task.status === 'done' || task.status === 'cancelled') return null;

  const steps = task.steps || [];
  // 前の番号に終わっていない手順があれば、そこが待たせている
  const blockers = blockersOf(task);
  const running = (blockers.length ? blockers : steps).find((s) => s.status === 'running');
  if (running) {
    return {
      kind: 'employee',
      state: 'running',
      employeeId: running.employeeId,
      roleId: running.roleId,
      name: running.employeeName || running.roleId,
      why: '実行中',
    };
  }
  // 前が詰まっていないなら、次に動く人が「まだ始めていない」
  const next = (blockers.length ? blockers : steps).find((s) => s.status === 'pending');
  if (!next) return null;
  return {
    kind: 'employee',
    state: 'idle',
    employeeId: next.employeeId,
    roleId: next.roleId,
    name: next.employeeName || next.roleId,
    why: 'まだ始めていない',
  };
}

/**
 * 待ち行列の全体。
 * @returns {{blockers:object[], owner:object[], flowing:number}}
 *   blockers … 他を待たせている社員（まだ始めていない数の多い順）
 *   owner    … あなた（オーナー）待ちの仕事
 *   flowing  … いま実際に動いている仕事の数
 */
export function buildQueue(tasks = [], employees = []) {
  const byEmp = new Map();
  const owner = [];
  let flowing = 0;

  for (const t of tasks) {
    // **完了を先に外さない。** 完了していても判断が残っていれば
    // 「あなた待ち」で、それを外すと待ち行列から消えてしまう。
    if (!t || t.status === 'cancelled') continue;
    const w = waitingOn(t);
    if (!w) continue;
    if (w.kind === 'owner') {
      owner.push({ taskId: t.id, title: t.title, why: w.why, since: sinceOf(t) });
      continue;
    }
    if (w.state === 'running') flowing += 1;
    const key = w.employeeId || w.name;
    if (!byEmp.has(key)) {
      const emp = employees.find((e) => e.id === w.employeeId) || null;
      byEmp.set(key, {
        employeeId: w.employeeId,
        name: emp ? emp.name : w.name,
        // 辞めた社員などで見つからない時は、手順に書かれている役職を使う
        // （null のままだと「雇う」が既定の役職を開いてしまう）。
        roleId: (emp && emp.roleId) || w.roleId || null,
        waiting: [],
        running: [],
      });
    }
    const row = byEmp.get(key);
    (w.state === 'running' ? row.running : row.waiting).push({ taskId: t.id, title: t.title, why: w.why });
  }

  const blockers = [...byEmp.values()].sort(
    (a, b) => b.waiting.length - a.waiting.length || b.running.length - a.running.length
  );
  return { blockers, owner, flowing };
}

function sinceOf(task) {
  if (task.status === 'on_hold') return task.heldAt || task.finishedAt || task.startedAt || task.createdAt || 0;
  return task.finishedAt || task.startedAt || task.createdAt || 0;
}

/**
 * いちばん多くを待たせている社員（2件以上を止めている人だけ）。
 * 1件だけなら「順番に進んでいる」ので、詰まりとは言わない。
 */
export function worstBlocker(queue) {
  const top = queue && queue.blockers[0];
  return top && top.waiting.length >= 2 ? top : null;
}
