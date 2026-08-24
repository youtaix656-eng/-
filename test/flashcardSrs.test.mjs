import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weakCardIds, cardMastered, cardWrongCount } from '../src/lib/flashcardSrs.js';
import { applyAnswer } from '../src/lib/srs.js';

test('weakCardIds: 間違えたことがありまだマスターしていないカードだけを返す', () => {
  let a = applyAnswer(undefined, false); // 'a' は一度誤答
  let b = applyAnswer(undefined, true); // 'b' は一度も間違えていない
  const srsMap = { a, b };
  assert.deepEqual(weakCardIds(srsMap, ['a', 'b', 'c']), ['a']);
});

test('cardMastered: 5回連続正解でマスター扱いになる', () => {
  let s;
  for (let i = 0; i < 5; i++) s = applyAnswer(s, true);
  const srsMap = { x: s };
  assert.equal(cardMastered(srsMap, 'x'), true);
});

test('cardWrongCount: 未記録は0、誤答のたびに増える', () => {
  const srsMap = {};
  assert.equal(cardWrongCount(srsMap, 'none'), 0);
  let s = applyAnswer(undefined, false);
  s = applyAnswer(s, false);
  assert.equal(cardWrongCount({ y: s }, 'y'), 2);
});
