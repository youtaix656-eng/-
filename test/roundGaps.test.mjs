import test from 'node:test';
import assert from 'node:assert/strict';
import { roundsBySubject, allRounds, roundGapsBySubject } from '../src/lib/roundGaps.js';

function q(id, subject, round) {
  return { id, subject, round, question: 'x', choices: ['a', 'b'], answer: 0, type: 'ox' };
}

test('roundsBySubject: 科目ごとに収録済み回を集計する', () => {
  const qs = [q('1', 'A', 30), q('2', 'A', 31), q('3', 'B', 30)];
  const map = roundsBySubject(qs);
  assert.deepEqual([...map.get('A')].sort(), ['30', '31']);
  assert.deepEqual([...map.get('B')], ['30']);
});

test('allRounds: 全科目を通じた回の一覧を新しい順で返す', () => {
  const qs = [q('1', 'A', 30), q('2', 'B', 32), q('3', 'C', 31)];
  assert.deepEqual(allRounds(qs), ['32', '31', '30']);
});

test('roundGapsBySubject: 他科目に複数ある回が無い科目を検出する', () => {
  const qs = [
    q('1', 'A', 30), q('2', 'A', 31), q('3', 'A', 32),
    q('4', 'B', 30), q('5', 'B', 31), q('6', 'B', 32),
    q('7', 'C', 30), q('8', 'C', 31), // Cだけ32が抜けている
  ];
  const gaps = roundGapsBySubject(qs, { minOtherSubjects: 2 });
  const cGap = gaps.find((g) => g.subject === 'C');
  assert.ok(cGap);
  assert.deepEqual(cGap.missing, ['32']);
});

test('roundGapsBySubject: 収録が0件の科目は対象外', () => {
  const qs = [q('1', 'A', 30), q('2', 'B', 30)];
  const gaps = roundGapsBySubject(qs);
  assert.equal(gaps.find((g) => g.subject === 'D'), undefined);
});

test('roundGapsBySubject: minOtherSubjects未満の回はそもそも比較対象にしない', () => {
  const qs = [q('1', 'A', 30), q('2', 'A', 40)]; // 40はA科目にしか無い
  const gaps = roundGapsBySubject(qs, { minOtherSubjects: 2 });
  assert.deepEqual(gaps, []);
});
