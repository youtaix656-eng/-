import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integratedCoverage } from '../src/lib/integratedCoverage.js';

const BLUEPRINTS = [
  { session: 'am', label: '午前', slots: [{ subject: '総合問題', count: 8, integrated: true, note: 'AM総合' }] },
  { session: 'pm', label: '午後', slots: [{ subject: '総合問題', count: 10, integrated: true, note: 'PM総合' }] },
];

test('integratedCoverage: 収録なしなら0件・目標数はブループリント通り', () => {
  const out = integratedCoverage([], BLUEPRINTS);
  assert.equal(out.totalTarget, 18);
  assert.equal(out.totalCollected, 0);
  assert.equal(out.bySession[0].targetCount, 8);
  assert.equal(out.bySession[1].targetCount, 10);
});

test('integratedCoverage: 総合問題のみを対象にし、examSessionとcaseIdを集計する', () => {
  const questions = [
    { id: 'q1', subject: '総合問題', examSession: 'am', caseId: 'ig-1' },
    { id: 'q2', subject: '総合問題', examSession: 'am', caseId: 'ig-1' },
    { id: 'q3', subject: '総合問題', examSession: 'pm', caseId: 'ig-2' },
    { id: 'q4', subject: '臨床医学各論' }, // 総合問題ではないので対象外
  ];
  const out = integratedCoverage(questions, BLUEPRINTS);
  const am = out.bySession.find((b) => b.session === 'am');
  const pm = out.bySession.find((b) => b.session === 'pm');
  assert.equal(am.collectedCount, 2);
  assert.equal(am.caseCount, 1); // 同じcaseIdなので事例は1つ
  assert.equal(pm.collectedCount, 1);
  assert.equal(out.totalCollected, 3);
});
