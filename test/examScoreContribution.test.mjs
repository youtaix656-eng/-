import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreContribution, pointsShortOfPassLine } from '../src/lib/examScoreContribution.js';

const blueprint = {
  totalCount: 10,
  slots: [
    { subject: 'A', count: 8 },
    { subject: 'B', count: 2 },
  ],
};

test('scoreContribution: 出題数の重み×失点率で優先度を出す', () => {
  const perSubject = {
    A: { total: 8, correct: 4 }, // 正答率50%・重み0.8
    B: { total: 2, correct: 0 }, // 正答率0%・重み0.2
  };
  const rows = scoreContribution(perSubject, blueprint);
  // A: 0.8*0.5=0.4 / B: 0.2*1.0=0.2 → Aが優先
  assert.equal(rows[0].subject, 'A');
  assert.ok(Math.abs(rows[0].lossContribution - 0.4) < 1e-9);
});

test('scoreContribution: 解答が無い科目は対象外', () => {
  const perSubject = { A: { total: 8, correct: 8 } };
  const rows = scoreContribution(perSubject, blueprint);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].subject, 'A');
});

test('pointsShortOfPassLine: 合格ラインまでの不足問数を返す', () => {
  assert.equal(pointsShortOfPassLine(50, 90, 0.6), 4); // 必要54問、50問正解→あと4問
  assert.equal(pointsShortOfPassLine(60, 90, 0.6), 0); // 届いている
});
