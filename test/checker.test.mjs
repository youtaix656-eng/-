import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkFormat,
  checkDuplicates,
  checkContradictions,
  checkAgainstKB,
  runAllChecks,
} from '../src/lib/checker.js';

const ok = {
  id: 'ok1',
  subject: 'S',
  type: 'choice',
  question: '合谷が属する経絡はどれか。',
  choices: ['手の陽明大腸経', '手の太陰肺経', '手の少陰心経', '手の厥陰心包経'],
  answer: 0,
  explanation: '合谷は大腸経の原穴。',
};

test('正常な問題は形式エラーなし', () => {
  const f = checkFormat(ok).filter((x) => x.severity === 'error');
  assert.equal(f.length, 0);
});

test('正解インデックス範囲外を検出', () => {
  const f = checkFormat({ ...ok, id: 'x', answer: 9 });
  assert.ok(f.some((x) => x.severity === 'error' && x.category === 'format'));
});

test('選択肢の重複を検出', () => {
  const f = checkFormat({ ...ok, id: 'x', choices: ['a', 'a', 'b', 'c'] });
  assert.ok(f.some((x) => x.message.includes('重複')));
});

test('空の選択肢を検出', () => {
  const f = checkFormat({ ...ok, id: 'x', choices: ['a', '', 'b', 'c'] });
  assert.ok(f.some((x) => x.severity === 'error'));
});

test('重複した設問を検出', () => {
  const dup = [ok, { ...ok, id: 'ok2' }];
  const f = checkDuplicates(dup);
  assert.equal(f.length, 2);
  assert.ok(f.every((x) => x.category === 'duplicate'));
});

test('矛盾（同じ設問で正解違い）を検出', () => {
  const a = { ...ok, id: 'a' };
  const b = { ...ok, id: 'b', answer: 1 }; // 正解が違う
  const f = checkContradictions([a, b]);
  assert.equal(f.length, 2);
  assert.ok(f.every((x) => x.severity === 'error'));
});

test('KB照合: 経穴と経絡の不一致を検出', () => {
  // 合谷は大腸経なのに、正解を「肺経」にした誤問題
  const wrong = {
    id: 'w',
    subject: 'S',
    type: 'choice',
    question: '合谷が属する経絡はどれか。',
    choices: ['手の太陰肺経', '手の陽明大腸経', '手の少陰心経', '手の厥陰心包経'],
    answer: 0, // 誤：肺経
    explanation: '',
  };
  const f = checkAgainstKB([wrong]);
  assert.ok(f.some((x) => x.category === 'kb'));
});

test('KB照合: 正しい問題は指摘されない', () => {
  const f = checkAgainstKB([ok]);
  assert.equal(f.filter((x) => x.category === 'kb').length, 0);
});

test('runAllChecks が要約を返す', () => {
  const { findings, summary } = runAllChecks([ok, { ...ok, id: 'ok2' }]);
  assert.ok(summary.total >= 1);
  assert.equal(summary.warn >= 1, true); // 重複でwarn
  assert.ok(Array.isArray(findings));
});
