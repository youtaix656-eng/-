import { test } from 'node:test';
import assert from 'node:assert/strict';
import faq from '../src/data/faq.js';

test('faq.js: ちょうど30件収録されている', () => {
  assert.equal(faq.length, 30);
});

test('faq.js: id・questionが重複しない', () => {
  assert.equal(new Set(faq.map((f) => f.id)).size, faq.length);
  assert.equal(new Set(faq.map((f) => f.question)).size, faq.length);
});

test('faq.js: すべての項目がid/category/question/answerを備える', () => {
  faq.forEach((f) => {
    assert.ok(f.id && f.id.length > 0, 'idが空');
    assert.ok(f.category && f.category.length > 0, `${f.id}: categoryが空`);
    assert.ok(f.question && f.question.length > 5, `${f.id}: questionが短すぎる`);
    assert.ok(f.answer && f.answer.length > 5, `${f.id}: answerが短すぎる`);
    assert.ok(Array.isArray(f.tags), `${f.id}: tagsが配列でない`);
  });
});

test('faq.js: カテゴリは複数種類にまたがっている（1カテゴリに全部固まっていない）', () => {
  const categories = new Set(faq.map((f) => f.category));
  assert.ok(categories.size >= 4, `カテゴリ数が少なすぎる: ${categories.size}`);
});
