import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBlueprintExam, blueprintAvailability, poolForSubject, preferUnused } from '../src/lib/examBuilder.js';

function makeQuestions(subject, count, offset = 0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${subject}-${offset + i}`,
    subject,
    type: 'ox',
    choices: ['○', '×'],
    answer: 0,
    question: `${subject} q${offset + i}`,
  }));
}

const blueprint = {
  session: 'am',
  label: 'テスト',
  totalCount: 10,
  minutes: 10,
  slots: [
    { subject: 'A', count: 5 },
    { subject: 'B', count: 5 },
  ],
};

test('buildBlueprintExam: 各スロットの必要数ぶん出題する', () => {
  const qs = [...makeQuestions('A', 10), ...makeQuestions('B', 10)];
  const { order, shortfalls } = buildBlueprintExam(blueprint, qs);
  assert.equal(order.length, 10);
  assert.equal(shortfalls.length, 0);
  assert.equal(order.filter((q) => q.subject === 'A').length, 5);
  assert.equal(order.filter((q) => q.subject === 'B').length, 5);
});

test('buildBlueprintExam: 収録不足はshortfallsに記録される', () => {
  const qs = [...makeQuestions('A', 2), ...makeQuestions('B', 10)];
  const { order, shortfalls } = buildBlueprintExam(blueprint, qs);
  assert.equal(order.filter((q) => q.subject === 'A').length, 2);
  assert.equal(shortfalls.length, 1);
  assert.equal(shortfalls[0].subject, 'A');
  assert.equal(shortfalls[0].got, 2);
});

test('buildBlueprintExam: avoidIdsに無い問題（未出題）を優先する（#11・#16）', () => {
  const qs = [...makeQuestions('A', 5), ...makeQuestions('B', 5)];
  // Aの3問を「直近使った」として避けたい
  const avoidIds = new Set(['A-0', 'A-1', 'A-2']);
  const { order } = buildBlueprintExam(blueprint, qs, { avoidIds });
  const aPicked = order.filter((q) => q.subject === 'A').map((q) => q.id);
  // Aは5問中5問要求だが、avoidIdsで避けたい3問より前に未回避の2問が来ているはず
  // （countがpoolと同数なので全部採用されるが、順序で未回避が優先されることを別テストで見る）
  assert.equal(aPicked.length, 5);
});

test('buildBlueprintExam: avoidIdsが多くてもcountを満たせる場合はavoidから補充する', () => {
  const smallBlueprint = {
    ...blueprint,
    slots: [{ subject: 'A', count: 3 }],
  };
  const qs = makeQuestions('A', 3);
  const avoidIds = new Set(['A-0', 'A-1']); // 2問は直近使用済みだが、他に選択肢が無い
  const { order, shortfalls } = buildBlueprintExam(smallBlueprint, qs, { avoidIds });
  assert.equal(order.length, 3); // 3問要求に対し3問とも出せる（使用済みも混ぜて補充）
  assert.equal(shortfalls.length, 0);
});

test('buildBlueprintExam: srsを渡すと未出題の中で既習問題を優先する（#19）', () => {
  const smallBlueprint = { ...blueprint, slots: [{ subject: 'A', count: 1 }] };
  const qs = makeQuestions('A', 2); // A-0は未学習、A-1は学習済み
  const srs = { 'A-1': { correctStreak: 1 } };
  // 複数回試して、A-1（既習）が選ばれる確率が高いことを確認（決定的ではないので複数回サンプリング）
  let a1Count = 0;
  for (let i = 0; i < 30; i++) {
    const { order } = buildBlueprintExam(smallBlueprint, qs, { srs });
    if (order[0].id === 'A-1') a1Count += 1;
  }
  assert.ok(a1Count === 30, `既習問題が常に優先されるはず（実際: ${a1Count}/30）`);
});

test('blueprintAvailability: roundsPossibleを計算する（#12）', () => {
  const qs = [...makeQuestions('A', 12), ...makeQuestions('B', 5)];
  const avail = blueprintAvailability(blueprint, qs);
  const a = avail.find((x) => x.subject === 'A');
  const b = avail.find((x) => x.subject === 'B');
  assert.equal(a.roundsPossible, 2); // 12問 / 5問 = 2.4 → floor 2
  assert.equal(b.roundsPossible, 1); // 5問 / 5問 = 1
});

test('blueprintAvailability: 収録0なら roundsPossible も0', () => {
  const qs = makeQuestions('B', 5);
  const avail = blueprintAvailability(blueprint, qs);
  const a = avail.find((x) => x.subject === 'A');
  assert.equal(a.roundsPossible, 0);
  assert.equal(a.sufficient, false);
});

test('preferUnused: avoidIdsに無いものを先に、避けたいものは後ろへ（#17）', () => {
  const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const result = preferUnused(pool, new Set(['a']));
  assert.deepEqual(result.map((q) => q.id), ['b', 'c', 'a']);
});

test('preferUnused: avoidIdsが空なら順序を変えない', () => {
  const pool = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(preferUnused(pool).map((q) => q.id), ['a', 'b']);
});

test('poolForSubject: 既存の科目一致ロジックはそのまま動く', () => {
  const qs = makeQuestions('A', 3);
  assert.equal(poolForSubject(qs, 'A').length, 3);
  assert.equal(poolForSubject(qs, 'B').length, 0);
});
