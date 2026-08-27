// 止まっている時間（新規）。
//
// **人間が原因の遅れは、いまどこにも出ていなかった。**
// 承認待ち・判断待ち・保留・失敗のまま放置——どれも社員は動けない。
// AI費用の話ばかり見ていると、いちばん時間を食っているここが見えない。
//
// AIを1回も呼ばない。

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

// 止まり方の種類。どれも「オーナーが動けば進む」もの。
export const STALL_KINDS = [
  { id: 'approval', name: '承認待ち', glyph: '⚖', act: '承認画面へ', view: 'approvals' },
  { id: 'decision', name: '判断待ち', glyph: '⚖', act: '判断する', view: 'task' },
  { id: 'hold', name: '保留のまま', glyph: '‖', act: '保留を解く', view: 'task' },
  { id: 'failed', name: '止まったまま', glyph: '⚠', act: 'やり直す', view: 'task' },
];

export function stallKind(id) {
  return STALL_KINDS.find((k) => k.id === id) || STALL_KINDS[0];
}

/**
 * その仕事が「いつから」止まっているか。
 * 承認だけは承認の記録に時刻があるので、そちらを優先する（より正確）。
 */
export function stalledSince(task, approvals = []) {
  if (!task) return null;
  if (task.status === 'awaiting_approval') {
    const a = approvals.find((x) => x.taskId === task.id && x.status === 'pending');
    return { kind: 'approval', at: (a && a.createdAt) || task.startedAt || task.createdAt || 0 };
  }
  if (task.status === 'on_hold') {
    return { kind: 'hold', at: task.heldAt || task.finishedAt || task.startedAt || task.createdAt || 0 };
  }
  if (task.status === 'failed') {
    return { kind: 'failed', at: task.finishedAt || task.startedAt || task.createdAt || 0 };
  }
  const open = (task.decisions || []).filter((d) => d.state === 'open');
  if (open.length) {
    return { kind: 'decision', at: task.finishedAt || task.createdAt || 0 };
  }
  return null;
}

/**
 * いま止まっているもの全部。
 * @returns {{rows:object[], totalMs:number, worst:object|null, counts:object}}
 */
export function buildStalls({ tasks = [], approvals = [], now = Date.now() } = {}) {
  const rows = [];
  for (const t of tasks) {
    if (!t || t.status === 'cancelled') continue;
    const s = stalledSince(t, approvals);
    if (!s || !s.at) continue;
    rows.push({
      taskId: t.id,
      title: t.title,
      kind: s.kind,
      since: s.at,
      ms: Math.max(0, now - s.at),
    });
  }
  rows.sort((a, b) => b.ms - a.ms);
  const counts = {};
  for (const r of rows) counts[r.kind] = (counts[r.kind] || 0) + 1;
  return {
    rows,
    totalMs: rows.reduce((n, r) => n + r.ms, 0),
    worst: rows[0] || null,
    counts,
  };
}

/** 「3時間」「2日」のような言い方にする。 */
export function humanDuration(ms) {
  const n = Math.max(0, Number(ms) || 0);
  if (n < HOUR_MS) return `${Math.max(1, Math.round(n / 60000))}分`;
  if (n < DAY_MS) return `${Math.round(n / HOUR_MS)}時間`;
  return `${Math.round(n / DAY_MS)}日`;
}

/** 半日以上止まっているものだけ（短い待ちは急かさない）。 */
export const NAG_AFTER_MS = 12 * HOUR_MS;

export function longStalls(stalls, limit = 5) {
  return (stalls ? stalls.rows : []).filter((r) => r.ms >= NAG_AFTER_MS).slice(0, limit);
}
