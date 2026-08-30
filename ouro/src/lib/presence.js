// 在席ボード（新規）。「誰がいま何をしているか」。
//
// **AIを1回も呼ばない。** 仕事（tasks）から導くだけなので費用ゼロ。
// 会議を開かなくても、社員の状況が一目で分かる状態をまず作る。

export const PRESENCE_STATES = [
  { id: 'running', name: '実行中', glyph: '⟳', order: 1 },
  { id: 'queued', name: '順番待ち', glyph: '…', order: 2 },
  { id: 'waiting', name: 'あなた待ち', glyph: '⚖', order: 3 },
  { id: 'held', name: '保留', glyph: '‖', order: 4 },
  { id: 'stopped', name: '止まっている', glyph: '⚠', order: 5 },
  { id: 'idle', name: '手あき', glyph: '·', order: 6 },
];

export function presenceState(id) {
  return PRESENCE_STATES.find((s) => s.id === id) || PRESENCE_STATES[5];
}

/**
 * 社員1人の在席。**いちばん手当てが要る状態を返す**
 * （実行中 > あなた待ち > 止まっている > 保留 > 順番待ち > 手あき）。
 * @returns {{state:string, task:object|null, note:string}}
 */
export function presenceOf(employee, tasks = []) {
  const mine = tasks.filter((t) => (t.steps || []).some((s) => s.employeeId === employee.id));
  const pick = (fn) => mine.find(fn) || null;

  // **「その仕事が動いている」ではなく「その人の手順が動いている」で見る。**
  // 仕事単位で見ると、同じ仕事の順番待ちの人まで実行中に見えてしまう。
  const running = pick((t) =>
    (t.steps || []).some((s) => s.employeeId === employee.id && s.status === 'running')
  );
  if (running) return { state: 'running', task: running, note: stepNote(running, employee) };

  const waiting = pick((t) => t.status === 'awaiting_approval' || openDecisions(t));
  if (waiting) {
    return {
      state: 'waiting',
      task: waiting,
      note: waiting.status === 'awaiting_approval' ? '承認を待っています' : 'あなたの判断を待っています',
    };
  }

  const stopped = pick((t) => t.status === 'failed');
  if (stopped) return { state: 'stopped', task: stopped, note: '途中で止まりました' };

  const held = pick((t) => t.status === 'on_hold');
  if (held) return { state: 'held', task: held, note: held.holdReason || '保留中' };

  const queued = pick(
    (t) => ['queued', 'running'].includes(t.status) && (t.steps || []).some((s) => s.employeeId === employee.id && s.status === 'pending')
  );
  if (queued) return { state: 'queued', task: queued, note: '自分の番を待っています' };

  return { state: 'idle', task: null, note: '' };
}

function openDecisions(task) {
  return (task.decisions || []).some((d) => d.state === 'open');
}

function stepNote(task, employee) {
  const s = (task.steps || []).find((x) => x.employeeId === employee.id && x.status === 'running');
  return s ? String(s.instruction || '').slice(0, 40) : '';
}

/** 在籍している社員ぶんの在席（手当てが要る順に並べる）。 */
export function buildPresence(employees = [], tasks = []) {
  return employees
    .map((e) => ({ employee: e, ...presenceOf(e, tasks) }))
    .sort((a, b) => presenceState(a.state).order - presenceState(b.state).order);
}

/** 状態ごとの人数。 */
export function presenceCounts(rows = []) {
  const out = {};
  for (const r of rows) out[r.state] = (out[r.state] || 0) + 1;
  return out;
}
