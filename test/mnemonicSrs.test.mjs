import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weakMnemonicKeywords, mnemonicMastered, mnemonicWrongCount } from '../src/lib/mnemonicSrs.js';
import { applyAnswer } from '../src/lib/srs.js';

test('weakMnemonicKeywords: 一度でも「まだ」を選びまだマスターしていないものだけ', () => {
  const a = applyAnswer(undefined, false);
  const b = applyAnswer(undefined, true);
  const srsMap = { a, b };
  assert.deepEqual(weakMnemonicKeywords(srsMap, ['a', 'b', 'c']), ['a']);
});

test('mnemonicMastered: 5回連続正解でマスター扱い', () => {
  let s;
  for (let i = 0; i < 5; i++) s = applyAnswer(s, true);
  assert.equal(mnemonicMastered({ x: s }, 'x'), true);
});

test('mnemonicWrongCount: 未記録は0', () => {
  assert.equal(mnemonicWrongCount({}, 'none'), 0);
});
