import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateQuestion,
  validateBank,
  findDuplicateStems,
  findLogicalDuplicates,
} from '../src/lib/questionSchema.js';

const good4 = {
  id: 'q1', subject: '臨床医学各論', type: 'choice',
  question: '正しいのはどれか。', choices: ['ア', 'イ', 'ウ', 'エ'], answer: 2,
  explanation: '解説。', tags: ['タグ'],
};
const goodOx = {
  id: 'q2', subject: '臨床医学各論', type: 'ox',
  question: 'これは正しい。', choices: ['○（正しい）', '×（誤り）'], answer: 0,
  explanation: '解説。',
};

test('正しい四択・○×はエラー0', () => {
  assert.deepEqual(validateQuestion(good4), []);
  assert.deepEqual(validateQuestion(goodOx), []);
});

test('四択の選択肢数・answer範囲を検出', () => {
  assert.ok(validateQuestion({ ...good4, choices: ['ア', 'イ', 'ウ'] }).some((e) => e.includes('四択の選択肢')));
  assert.ok(validateQuestion({ ...good4, answer: 4 }).some((e) => e.includes('範囲外')));
  assert.ok(validateQuestion({ ...good4, answer: 1.5 }).some((e) => e.includes('整数でない')));
});

test('○×は2択・解説必須・選択肢重複を検出', () => {
  assert.ok(validateQuestion({ ...goodOx, choices: ['○'] }).some((e) => e.includes('○×の選択肢')));
  assert.ok(validateQuestion({ ...good4, explanation: '' }).some((e) => e.includes('解説')));
  assert.ok(validateQuestion({ ...good4, choices: ['ア', 'ア', 'ウ', 'エ'] }).some((e) => e.includes('選択肢に重複')));
});

test('round は数値でも文字列でも可、その他型はエラー', () => {
  assert.deepEqual(validateQuestion({ ...good4, round: 30 }), []);
  assert.deepEqual(validateQuestion({ ...good4, round: '第30回' }), []);
  assert.ok(validateQuestion({ ...good4, round: {} }).some((e) => e.includes('round')));
});

test('findDuplicateStems は完全一致の問題文を検出', () => {
  const dups = findDuplicateStems([
    { question: '同じ問題文。' }, { question: '同じ問題文。' }, { question: '別。' },
  ]);
  assert.equal(dups.length, 1);
  assert.equal(dups[0].count, 2);
});

test('validateBank は重複idと違反件数を集計', () => {
  const rep = validateBank([good4, { ...goodOx, id: 'q1' }, { ...good4, id: 'q3', answer: 9 }]);
  assert.equal(rep.dupIds.length, 1); // q1 が2回
  assert.ok(rep.perQuestion.some((p) => p.id === 'q3'));
  assert.equal(rep.ok, false);
});

test('findLogicalDuplicates は同科目・同正解・同タグを候補化', () => {
  const cand = findLogicalDuplicates([
    { id: 'a', subject: 'X', choices: ['正', 'イ', 'ウ', 'エ'], answer: 0, tags: ['t1', 't2'] },
    { id: 'b', subject: 'X', choices: ['ウ', 'エ', '正', 'オ'], answer: 2, tags: ['t1', 't2'] },
  ]);
  assert.equal(cand.length, 1);
  assert.deepEqual(cand[0].ids.sort(), ['a', 'b']);
});
