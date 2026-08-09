import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathQuizzes, groupQuizzes, buildOptions } from '../src/lib/kgQuiz.js';
import { emptyGraph, addCoOccurrence, addEdge } from '../src/lib/knowledgeGraph.js';

test('pathQuizzes: A―M―B の中間Mを正解に', () => {
  const g = emptyGraph();
  // M(利尿薬) が A(心不全) と B(低カリウム血症) をつなぐが、A-B は直接つながらない
  addCoOccurrence(g, ['心不全', '利尿薬']);
  addCoOccurrence(g, ['利尿薬', '低カリウム血症']);
  addCoOccurrence(g, ['ダミー1', 'ダミー2']); // distractor 用
  const qz = pathQuizzes(g);
  const q = qz.find((x) => x.answer === '利尿薬');
  assert.ok(q, '利尿薬を中間とする問題ができる');
  assert.ok([q.a, q.b].includes('心不全') && [q.a, q.b].includes('低カリウム血症'));
  assert.ok(q.distractors.length >= 1);
});

test('pathQuizzes: 直接つながるペアは中間問題にしない', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['A', 'B', 'C']); // 三角形＝全直結
  const qz = pathQuizzes(g);
  assert.equal(qz.length, 0);
});

test('groupQuizzes: 同じかたまりの仲間が正解', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['心不全', '利尿薬']); // かたまり1
  addCoOccurrence(g, ['骨折', 'ギプス']); // かたまり2
  const qz = groupQuizzes(g);
  assert.ok(qz.length >= 1);
  const q = qz[0];
  // concept と answer は同じかたまり、distractors は別かたまり
  assert.notEqual(q.answer, q.concept);
  assert.ok(q.distractors.length >= 1);
});

test('buildOptions: 正解を含む選択肢をまぜる', () => {
  const opts = buildOptions('正', ['ア', 'イ', 'ウ'], () => 0);
  assert.equal(opts.length, 4);
  assert.ok(opts.includes('正'));
});

import { fillBlankQuizzes } from '../src/lib/kgQuiz.js';
test('fillBlankQuizzes: 中心の隣接から隠した1つを当てる', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['心不全', '利尿薬', 'BNP', '浮腫']); // 心不全に3隣接
  addCoOccurrence(g, ['遠い1', '遠い2']); // distractor
  const qz = fillBlankQuizzes(g);
  const q = qz.find((x) => x.center === '心不全');
  assert.ok(q, '心不全を中心とした穴埋めができる');
  assert.ok(!q.shown.includes(q.answer), '答えは表示側に含まれない');
  assert.ok(q.distractors.length >= 1);
});
