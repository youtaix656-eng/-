import { test } from 'node:test';
import assert from 'node:assert/strict';
import { halfSplitAccuracy } from '../src/lib/examHalfSplit.js';

function mkOrder(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `q${i}`, answer: 0 }));
}

test('halfSplitAccuracy: 前半/後半で問題数を均等に近く分割する（奇数は前半に1問多い）', () => {
  const order = mkOrder(5);
  const answers = [0, 0, 0, 0, 0]; // 全問正解
  const out = halfSplitAccuracy(order, answers);
  assert.equal(out.first.total, 3);
  assert.equal(out.second.total, 2);
});

test('halfSplitAccuracy: 後半で正答率が落ちるとdropPtが正の値になる', () => {
  const order = mkOrder(10);
  const answers = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]; // 前半全問正解、後半全問不正解
  const out = halfSplitAccuracy(order, answers);
  assert.equal(out.first.accuracy, 1);
  assert.equal(out.second.accuracy, 0);
  assert.equal(out.dropPt, 100);
});

test('halfSplitAccuracy: 後半の方が良ければdropPtは負の値', () => {
  const order = mkOrder(10);
  const answers = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
  const out = halfSplitAccuracy(order, answers);
  assert.equal(out.dropPt, -100);
});

test('halfSplitAccuracy: 問題数が1問以下ならnull', () => {
  assert.equal(halfSplitAccuracy([{ id: 'a', answer: 0 }], [0]), null);
  assert.equal(halfSplitAccuracy([], []), null);
});
