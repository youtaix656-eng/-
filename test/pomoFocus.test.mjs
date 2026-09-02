import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusAverageSince, FOCUS_LEVELS } from '../src/lib/pomoFocus.js';

test('FOCUS_LEVELS: 3段階（3〜1）が定義されている', () => {
  assert.equal(FOCUS_LEVELS.length, 3);
  assert.deepEqual(FOCUS_LEVELS.map((f) => f.level), [3, 2, 1]);
});

test('focusAverageSince: 基準時刻以降の平均を返す', () => {
  const log = [{ level: 3, at: 100 }, { level: 1, at: 200 }, { level: 3, at: 50 }];
  assert.equal(focusAverageSince(log, 100), 2); // (3+1)/2
});

test('focusAverageSince: 記録が無ければnull（0点にしない）', () => {
  assert.equal(focusAverageSince([], 0), null);
  assert.equal(focusAverageSince([{ level: 3, at: 10 }], 100), null);
});
