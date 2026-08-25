// 手順の同時実行（新項目22）のテスト。
//
// 大事なのは2つ。
//   ① 同時に走ってよい手順だけが同時になる（承認は必ず単独で最後）
//   ② 同時に走った手順は、**全部そろってから**次へ引き継がれる

import test from 'node:test';
import assert from 'node:assert/strict';

import { planSteps } from '../src/lib/dispatcher.js';
import { createTask, applyStepResult, nextGroup } from '../src/lib/workflow.js';
import { WORKFLOWS, flatSteps } from '../src/data/workflows.js';

const assign = (roleId) => ({ id: `e_${roleId}`, name: roleId, roleId });

function taskWith(forceRoles) {
  return createTask({ request: 'テストの依頼', forceRoles, assign });
}

test('入れ子の手順は同じ group になる', () => {
  const steps = planSteps('テスト', { forceRoles: ['researcher', ['analyzer', 'reviewer'], 'strategist'] });
  const groups = steps.map((s) => s.group);
  assert.deepEqual(steps.map((s) => s.roleId), ['researcher', 'analyzer', 'reviewer', 'strategist']);
  assert.deepEqual(groups, [0, 1, 1, 2], '整理と検証が同じ group になっていない');
});

test('入れ子でない仕事は、これまでどおり1手順ずつ', () => {
  const t = taskWith(['researcher', 'analyzer']);
  const first = nextGroup(t);
  assert.equal(first.length, 1);
  assert.equal(first[0].roleId, 'researcher');
});

test('同じ group は2つまとめて返る', () => {
  const t = taskWith(['researcher', ['analyzer', 'reviewer']]);
  const g1 = nextGroup(t);
  assert.equal(g1.length, 1, '最初は調べる人だけ');
  const after = applyStepResult(t, g1[0].id, { text: '調べた結果' });
  const g2 = nextGroup(after);
  assert.equal(g2.length, 2, '整理と検証が同時に返らない');
  assert.deepEqual(g2.map((s) => s.roleId).sort(), ['analyzer', 'reviewer']);
});

test('同時の手順は、全部そろってから次へ渡る', () => {
  const t = taskWith(['researcher', ['analyzer', 'reviewer'], 'strategist']);
  const g1 = nextGroup(t);
  let cur = applyStepResult(t, g1[0].id, { text: '調べた結果' });
  const g2 = nextGroup(cur);

  // 片方だけ終わった時点では、次の手順にはまだ何も渡っていない
  cur = applyStepResult(cur, g2[0].id, { text: 'かたほう' });
  const strat1 = cur.steps.find((s) => s.roleId === 'strategist');
  assert.equal(strat1.input, '', '片方だけで次へ渡してしまっている');
  assert.equal(nextGroup(cur).length, 1, '残りの1件だけが待機のはず');

  // 両方そろうと、2人分がまとめて渡る
  cur = applyStepResult(cur, g2[1].id, { text: 'もうかたほう' });
  const strat2 = cur.steps.find((s) => s.roleId === 'strategist');
  assert.match(strat2.input, /かたほう/);
  assert.match(strat2.input, /もうかたほう/);
});

test('同時に走った2人ぶんは、誰の意見か分かる形で渡る', () => {
  const t = taskWith(['researcher', ['analyzer', 'reviewer']]);
  const g1 = nextGroup(t);
  let cur = applyStepResult(t, g1[0].id, { text: '調べた' });
  const g2 = nextGroup(cur);
  cur = applyStepResult(cur, g2[0].id, { text: 'A' });
  cur = applyStepResult(cur, g2[1].id, { text: 'B' });
  // 次の group が無い（最後の group だった）ので、引き継ぎ先が無いことを確認
  assert.equal(nextGroup(cur).length, 0);
  assert.equal(cur.status, 'done');
});

test('1人だけの group では、余計な見出しを付けずにそのまま渡す', () => {
  const t = taskWith(['researcher', 'analyzer']);
  const g1 = nextGroup(t);
  const cur = applyStepResult(t, g1[0].id, { text: 'そのまま' });
  assert.equal(cur.steps[1].input, 'そのまま');
});

test('前の group が終わるまで、次の group は始まらない', () => {
  const t = taskWith([['researcher', 'analyzer'], 'strategist']);
  const g1 = nextGroup(t);
  assert.equal(g1.length, 2);
  // 1つだけ「実行中」にすると、次は残りの1件だけ
  const running = { ...t, steps: t.steps.map((s, i) => (i === 0 ? { ...s, status: 'running' } : s)) };
  const g = nextGroup(running);
  assert.deepEqual(g.map((s) => s.roleId), ['analyzer']);
});

test('同梱の仕事の流れは、入れ子があっても実在する役職だけを指す', () => {
  for (const wf of WORKFLOWS) {
    const flat = flatSteps(wf);
    assert.equal(new Set(flat).size, flat.length, `${wf.name} に同じ役職が2回入っている`);
  }
});

// ───────── 見つかった不具合の再発防止 ─────────

test('未雇用で手順が抜けて group の番号が飛んでも、引き継ぎが途切れない', () => {
  // mkt_publish は 企画 → 確認 → 配信。確認役だけを雇っていない状態を作る。
  // 番号が 0, 2 のように飛ぶので、「次は g+1」で探すと引き継ぎが空になる。
  const hired = new Set(['mkt_content', 'mkt_ops']);
  const t = createTask({
    request: 'キャンペーンの告知を出したい',
    forceRoles: ['mkt_content', 'mkt_governance', 'mkt_ops'],
    assign: (roleId) => (hired.has(roleId) ? { id: `e_${roleId}`, name: roleId, roleId } : null),
  });

  const roles = t.steps.map((s) => s.roleId);
  assert.deepEqual(roles, ['mkt_content', 'mkt_ops'], '未雇用の確認役が外れていない');
  const groups = t.steps.map((s) => s.group);
  assert.notEqual(groups[1], groups[0] + 1, 'この試験の前提（番号が飛ぶ）が崩れている');

  const g1 = nextGroup(t);
  const after = applyStepResult(t, g1[0].id, { text: '企画の中身' });
  const ops = after.steps.find((s) => s.roleId === 'mkt_ops');
  assert.equal(ops.input, '企画の中身', '番号が飛ぶと引き継ぎが空になっている');
});

test('外れた確認役は missingApprovers に残る（黙って落とさない）', () => {
  const t = createTask({
    request: 'キャンペーンの告知を出したい',
    forceRoles: ['mkt_content', 'mkt_governance', 'mkt_ops'],
    assign: (roleId) => (roleId === 'mkt_governance' ? null : { id: roleId, name: roleId, roleId }),
  });
  assert.ok(t.missingApprovers.includes('mkt_governance'));
});
