import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickExplainQuestion } from '../src/lib/explainNotes.js';
import { MASTER_STREAK } from '../src/lib/srs.js';

test('pickExplainQuestion: マスター済みが無ければnull', () => {
  const questions = [{ id: 'a' }, { id: 'b' }];
  const srs = { a: { correctStreak: 1 }, b: { correctStreak: 0 } };
  assert.equal(pickExplainQuestion(questions, srs, '2026-08-23'), null);
});

test('pickExplainQuestion: マスター済みだけが対象になる', () => {
  const questions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const srs = {
    a: { correctStreak: MASTER_STREAK },
    b: { correctStreak: 1 },
    c: { correctStreak: MASTER_STREAK },
  };
  const picked = pickExplainQuestion(questions, srs, '2026-08-23');
  assert.ok(['a', 'c'].includes(picked.id));
});

test('pickExplainQuestion: 同じ日は同じ問題が選ばれる', () => {
  const questions = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}` }));
  const srs = Object.fromEntries(questions.map((q) => [q.id, { correctStreak: MASTER_STREAK }]));
  const a = pickExplainQuestion(questions, srs, '2026-08-23');
  const b = pickExplainQuestion(questions, srs, '2026-08-23');
  assert.equal(a.id, b.id);
});
