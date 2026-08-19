import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundKey, formatRound, isSameRound } from '../src/lib/round.js';

test('roundKey: 数値・数値文字列・フル文字列のいずれからも数字部分を取り出す', () => {
  assert.equal(roundKey(34), '34');
  assert.equal(roundKey('34'), '34');
  assert.equal(roundKey('第34回'), '34');
  assert.equal(roundKey(null), null);
  assert.equal(roundKey(undefined), null);
});

test('formatRound: 表記のゆらぎに関わらず同じ表示文字列になる', () => {
  assert.equal(formatRound(34), '第34回');
  assert.equal(formatRound('34'), '第34回');
  assert.equal(formatRound('第34回'), '第34回');
});

test('isSameRound: 表記が違っても同じ回なら true', () => {
  assert.equal(isSameRound(34, '第34回'), true);
  assert.equal(isSameRound('34', 34), true);
  assert.equal(isSameRound(34, '第33回'), false);
});
