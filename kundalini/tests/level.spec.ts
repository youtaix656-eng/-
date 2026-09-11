import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFor, nextLevel, normalizeThresholds, chakraFor } from '../src/lib/level.js';
import { CHAKRAS, DEFAULT_THRESHOLDS } from '../src/data/chakras.js';

test('チャクラは7段（データが単一の正）', () => {
  assert.equal(CHAKRAS.length, 7);
  assert.equal(DEFAULT_THRESHOLDS.length, 7);
  assert.deepEqual(CHAKRAS.map((c) => c.level), [1, 2, 3, 4, 5, 6, 7]);
});

test('既定の境界でレベルが上がる', () => {
  assert.equal(levelFor(0, DEFAULT_THRESHOLDS), 1);
  assert.equal(levelFor(6, DEFAULT_THRESHOLDS), 1);
  assert.equal(levelFor(7, DEFAULT_THRESHOLDS), 2);
  assert.equal(levelFor(29, DEFAULT_THRESHOLDS), 3);
  assert.equal(levelFor(30, DEFAULT_THRESHOLDS), 4);
  assert.equal(levelFor(365, DEFAULT_THRESHOLDS), 7);
  assert.equal(levelFor(9999, DEFAULT_THRESHOLDS), 7);
});

test('壊れた設定でも落ちない（昇順・7個・先頭は0・同値は離す）', () => {
  assert.deepEqual(normalizeThresholds(null), DEFAULT_THRESHOLDS);
  assert.deepEqual(normalizeThresholds([5, 1, 1, 1, 1, 1, 1]), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(normalizeThresholds([0, 0, 0, 0, 0, 0, 0])[0], 0);
});

test('次の段は「あと何日」と進み具合を返し、最上段では null', () => {
  const n = nextLevel(3, DEFAULT_THRESHOLDS);
  assert.ok(n);
  assert.equal(n.chakra.level, 2);
  assert.equal(n.daysLeft, 4);
  assert.ok(n.progress > 0.4 && n.progress < 0.5);
  assert.equal(nextLevel(400, DEFAULT_THRESHOLDS), null);
});

test('日数からチャクラを引ける', () => {
  assert.equal(chakraFor(0, DEFAULT_THRESHOLDS).name, 'ムーラーダーラ');
  assert.equal(chakraFor(365, DEFAULT_THRESHOLDS).name, 'サハスラーラ');
});
