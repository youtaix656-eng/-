import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestions, generateVariants, GENERATORS } from '../src/lib/generator.js';
import { yuanPoints, meridians } from '../src/data/knowledgeBase.js';

test('生成した問題は必要な項目を備える', () => {
  const qs = generateQuestions({ count: 8 });
  assert.equal(qs.length, 8);
  qs.forEach((q) => {
    assert.ok(q.question && q.question.length > 0);
    assert.ok(Array.isArray(q.choices) && q.choices.length >= 2);
    assert.ok(q.answer >= 0 && q.answer < q.choices.length);
    assert.equal(q.generated, true);
  });
});

test('生成問題の選択肢に重複がない', () => {
  const qs = generateQuestions({ count: 20 });
  qs.forEach((q) => {
    const set = new Set(q.choices);
    assert.equal(set.size, q.choices.length, `重複あり: ${q.question}`);
  });
});

test('経絡→原穴の生成は KB と正解が一致する', () => {
  // meridianToYuan だけを大量生成し、正解がKBの原穴と一致することを確認
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.meridianToYuan.fn();
    const m = meridians.find((x) => q.question.includes(x.name));
    assert.ok(m, '経絡名が設問に含まれる');
    assert.equal(q.choices[q.answer], yuanPoints[m.id]);
  }
});

test('相生の生成は正しい（木→火 など）', () => {
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.sheng.fn();
    const map = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
    const a = q.question.match(/「(.)」/)[1];
    assert.equal(q.choices[q.answer], map[a]);
  }
});

test('相剋の生成は正しい（木→土 など）', () => {
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.ke.fn();
    const map = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
    const a = q.question.match(/「(.)」/)[1];
    assert.equal(q.choices[q.answer], map[a]);
  }
});

test('指定タイプのみ生成される', () => {
  const qs = generateQuestions({ types: ['sheng'], count: 5 });
  qs.forEach((q) => assert.ok(q.tags.includes('相生')));
});

test('○×変形は正誤が整合する', () => {
  const base = {
    id: 'b1',
    subject: 'テスト',
    type: 'choice',
    question: '合谷が属する経絡はどれか。',
    choices: ['手の陽明大腸経', '手の太陰肺経', '手の少陰心経', '手の厥陰心包経'],
    answer: 0,
    explanation: '合谷は大腸経。',
  };
  const vs = generateVariants([base], { perQuestion: 2 });
  assert.ok(vs.length >= 1);
  vs.forEach((v) => {
    assert.equal(v.type, 'ox');
    assert.ok(v.answer === 0 || v.answer === 1);
    assert.equal(v.choices.length, 2);
  });
});
