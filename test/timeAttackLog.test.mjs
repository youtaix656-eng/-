import test from 'node:test';
import assert from 'node:assert/strict';
import { quickAnswerRate, QUICK_THRESHOLD_MS } from '../src/lib/timeAttackLog.js';

test('quickAnswerRate: 記録が無ければnull', () => {
  assert.equal(quickAnswerRate([]), null);
  assert.equal(quickAnswerRate(undefined), null);
});

test('quickAnswerRate: 正解かつ閾値以内の割合を返す', () => {
  const log = [
    { correct: true, ms: 3000 },
    { correct: true, ms: 6000 },
    { correct: false, ms: 2000 },
    { correct: true, ms: 4999 },
  ];
  assert.equal(quickAnswerRate(log), 2 / 4);
});

test('quickAnswerRate: 閾値ちょうどは含む（<=）', () => {
  const log = [{ correct: true, ms: QUICK_THRESHOLD_MS }];
  assert.equal(quickAnswerRate(log), 1);
});

test('quickAnswerRate: 不正解は閾値以内でも数えない', () => {
  const log = [{ correct: false, ms: 100 }, { correct: false, ms: 200 }];
  assert.equal(quickAnswerRate(log), 0);
});
