// 役職別の負荷（新規）。**どの役職を雇い足すべきか**を数字で出す。
//
// これまで「席が足りない」は勘で判断していた。
// 未完了の手順を役職ごとに数えて、1人あたりの持ち数を出す。
// 未雇用のまま計画から外された役職（task.unstaffedRoles）も一緒に見せる——
// そこは**そもそも担当が居ないので数字にすら出てこない**穴だった。
//
// AIを1回も呼ばない。

export const BUSY_PER_PERSON = 3; // 1人あたりこれを超えたら「重い」

/**
 * @returns {{rows:object[], unstaffed:object[]}}
 *   rows      … 在籍している役職の負荷（重い順）
 *   unstaffed … 求められたのに雇っていない役職（求められた回数の多い順）
 */
export function buildRoleLoad(tasks = [], employees = [], { now = Date.now(), days = 30 } = {}) {
  const since = now - days * 24 * 60 * 60 * 1000;
  const open = new Map(); // roleId -> 未完了の手順数
  const wants = new Map(); // roleId -> 外された回数

  for (const t of tasks) {
    if (!t || t.status === 'cancelled') continue;
    if (t.status !== 'done') {
      for (const s of t.steps || []) {
        if (s.status !== 'pending' && s.status !== 'running') continue;
        open.set(s.roleId, (open.get(s.roleId) || 0) + 1);
      }
    }
    if ((t.createdAt || 0) >= since) {
      for (const r of t.unstaffedRoles || []) wants.set(r, (wants.get(r) || 0) + 1);
    }
  }

  const headcount = new Map();
  for (const e of employees) headcount.set(e.roleId, (headcount.get(e.roleId) || 0) + 1);

  const rows = [];
  for (const [roleId, people] of headcount) {
    const openCount = open.get(roleId) || 0;
    const per = people > 0 ? openCount / people : openCount;
    rows.push({
      roleId,
      people,
      open: openCount,
      perPerson: Math.round(per * 10) / 10,
      heavy: per > BUSY_PER_PERSON,
    });
  }
  rows.sort((a, b) => b.perPerson - a.perPerson || b.open - a.open);

  const unstaffed = [...wants.entries()]
    .map(([roleId, count]) => ({ roleId, count }))
    .filter((x) => !headcount.has(x.roleId))
    .sort((a, b) => b.count - a.count);

  return { rows, unstaffed };
}

/** いちばん重い役職（在籍が居て、実際に重いものだけ）。 */
export function heaviestRole(load) {
  const row = load && load.rows.find((r) => r.heavy);
  return row || null;
}
