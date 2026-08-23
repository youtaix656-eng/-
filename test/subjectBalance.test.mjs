import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subjectBalanceWarning } from '../src/lib/stats.js';

function mkHistory(subject, correctCount, wrongCount) {
  const out = [];
  for (let i = 0; i < correctCount; i++) out.push({ subject, correct: true });
  for (let i = 0; i < wrongCount; i++) out.push({ subject, correct: false });
  return out;
}

test('subjectBalanceWarning: サンプル不足なら警告しない', () => {
  const questions = [{ subject: 'A' }, { subject: 'B' }];
  const history = [...mkHistory('A', 3, 0), ...mkHistory('B', 0, 3)];
  const out = subjectBalanceWarning(history, questions, { minSample: 15 });
  assert.equal(out.hasWarning, false);
});

test('subjectBalanceWarning: 他科目が高正答率で1科目だけ極端に低ければ警告', () => {
  const questions = [{ subject: 'A' }, { subject: 'B' }, { subject: 'C' }];
  const history = [
    ...mkHistory('A', 18, 2), // 90%
    ...mkHistory('B', 17, 3), // 85%
    ...mkHistory('C', 4, 16), // 20%
  ];
  const out = subjectBalanceWarning(history, questions);
  assert.equal(out.hasWarning, true);
  assert.deepEqual(out.weakSubjects.map((s) => s.subject), ['C']);
});

test('subjectBalanceWarning: 全体的に低いだけなら警告しない（相対差が小さい）', () => {
  const questions = [{ subject: 'A' }, { subject: 'B' }];
  const history = [...mkHistory('A', 10, 10), ...mkHistory('B', 9, 11)];
  const out = subjectBalanceWarning(history, questions);
  assert.equal(out.hasWarning, false);
});
