import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedProgress, isBehindPace, rankSlowQuestions } from '../src/lib/examPace.js';

test('expectedProgress: 経過割合に応じた問題番号の目安', () => {
  assert.equal(expectedProgress(0, 6000, 90), 0);
  assert.equal(expectedProgress(3000, 6000, 90), 45); // 半分経過→半分の問題数
  assert.equal(expectedProgress(6000, 6000, 90), 90);
  assert.equal(expectedProgress(9000, 6000, 90), 90); // 超過してもtotalQuestionsで頭打ち
});

test('expectedProgress: totalSecが0/未設定なら0', () => {
  assert.equal(expectedProgress(100, 0, 90), 0);
  assert.equal(expectedProgress(100, null, 90), 0);
});

test('isBehindPace: marginぶんの遅れは許容し、それ以上は遅れと判定', () => {
  assert.equal(isBehindPace(40, 42), false); // idx+1=41, 42-2=40 → 41<40は false
  assert.equal(isBehindPace(30, 42), true); // idx+1=31 < 40
  assert.equal(isBehindPace(50, 42), false); // 進んでいる
});

test('rankSlowQuestions: 時間のかかった順に上位を返す', () => {
  const order = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const timeSpent = [10, 90, 0, 40];
  const out = rankSlowQuestions(order, timeSpent, 2);
  assert.deepEqual(out.map((r) => r.q.id), ['b', 'd']);
  assert.equal(out[0].sec, 90);
});

test('rankSlowQuestions: 未記録(0秒)は除外される', () => {
  const order = [{ id: 'a' }, { id: 'b' }];
  const out = rankSlowQuestions(order, [0, 0], 5);
  assert.equal(out.length, 0);
});
