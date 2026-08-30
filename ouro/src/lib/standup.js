// 朝会（新規）。1日1回、進み具合をそろえる。
//
// **人数ぶんAIを呼ばない。** 18人いれば18回になり、いちばん高い会議より高くなる。
// 中身は仕事（tasks）から機械的に作る＝**費用ゼロ**。
// 「一言まとめ」だけは書記役1人に頼める（AI 1回）ので、そこは任意。

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 朝会の材料を作る。
 * @returns {{day:number, rows:object[], blocked:object[], counts:object}}
 */
export function buildStandup({ tasks = [], employees = [], now = Date.now() } = {}) {
  const today = startOfDay(now);
  const yesterday = today - DAY_MS;

  const rows = [];
  for (const emp of employees) {
    const mine = tasks.filter((t) => (t.steps || []).some((s) => s.employeeId === emp.id));
    const done = [];
    const todo = [];
    for (const t of mine) {
      for (const s of t.steps || []) {
        if (s.employeeId !== emp.id) continue;
        // 「昨日やったこと」＝前回の朝会からこちらで終わったもの
        if (s.status === 'done' && (s.finishedAt || 0) >= yesterday) {
          done.push({ taskId: t.id, title: t.title });
        }
        if (s.status === 'pending' || s.status === 'running') {
          todo.push({ taskId: t.id, title: t.title, running: s.status === 'running' });
        }
      }
    }
    if (!done.length && !todo.length) continue;
    rows.push({
      employeeId: emp.id,
      name: emp.name,
      roleId: emp.roleId,
      done: dedupe(done),
      todo: dedupe(todo),
    });
  }

  // 詰まっているもの（担当が居なくても出す）
  const blocked = tasks
    .filter((t) => t.status === 'failed' || t.status === 'on_hold' || hasOpenDecision(t))
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      why:
        t.status === 'failed'
          ? '途中で止まっています'
          : t.status === 'on_hold'
            ? `保留：${t.holdReason || '理由なし'}`
            : 'あなたの判断を待っています',
    }))
    .slice(0, 8);

  return {
    day: today,
    rows,
    blocked,
    counts: {
      people: rows.length,
      done: rows.reduce((n, r) => n + r.done.length, 0),
      todo: rows.reduce((n, r) => n + r.todo.length, 0),
      blocked: blocked.length,
    },
  };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((x) => (seen.has(x.taskId) ? false : seen.add(x.taskId))).slice(0, 4);
}

function hasOpenDecision(task) {
  return (task.decisions || []).some((d) => d.state === 'open');
}

/** 朝会を文章にする（掲示板・書記への材料の両方で使う）。 */
export function standupText(standup) {
  if (!standup) return '';
  const lines = [`## ${new Date(standup.day).toLocaleDateString('ja-JP')}の朝会`];
  if (!standup.rows.length && !standup.blocked.length) {
    lines.push('動いている仕事はありません。');
    return lines.join('\n');
  }
  for (const r of standup.rows) {
    const done = r.done.length ? r.done.map((x) => `「${x.title}」`).join('・') : 'なし';
    const todo = r.todo.length ? r.todo.map((x) => `「${x.title}」`).join('・') : 'なし';
    lines.push(`- ${r.name}／終えた：${done}／これから：${todo}`);
  }
  if (standup.blocked.length) {
    lines.push('', '### 詰まっていること');
    for (const b of standup.blocked) lines.push(`- 「${b.title}」${b.why}`);
  }
  return lines.join('\n');
}

/** 書記役への指示（AI 1回ぶん）。 */
export function standupSummaryPrompt(standup) {
  return [
    'あなたは今日の朝会の書記です。次の進捗を読んで、オーナーに向けて3行でまとめてください。',
    '1行目：今どこまで進んでいるか。2行目：今日いちばん先に手を付けるべきこと。',
    '3行目：オーナーが動かないと進まないこと（無ければ「なし」）。',
    '推測で数字を作らないでください。書かれていないことは書かないでください。',
    '',
    standupText(standup),
  ].join('\n');
}

/** 朝会を今日もう開いたか。 */
export function alreadyHeld(lastAt, now = Date.now()) {
  return Boolean(lastAt) && startOfDay(lastAt) === startOfDay(now);
}
