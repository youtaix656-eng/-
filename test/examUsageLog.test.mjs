import test from 'node:test';
import assert from 'node:assert/strict';
import { recentlyUsedIds, overlapWithLast } from '../src/lib/examUsageLog.js';

test('recentlyUsedIds: 同じmodeの直近N回ぶんのidを集める', () => {
  const log = [
    { mode: 'am', ids: ['a', 'b'], at: 3 },
    { mode: 'pm', ids: ['x'], at: 2 },
    { mode: 'am', ids: ['c'], at: 1 },
  ];
  const set = recentlyUsedIds(log, 'am', { withinCount: 2 });
  assert.deepEqual([...set].sort(), ['a', 'b', 'c']);
});

test('recentlyUsedIds: withinCountを超えた古い記録は含めない', () => {
  const log = [
    { mode: 'am', ids: ['a'], at: 3 },
    { mode: 'am', ids: ['b'], at: 2 },
    { mode: 'am', ids: ['c'], at: 1 },
  ];
  const set = recentlyUsedIds(log, 'am', { withinCount: 1 });
  assert.deepEqual([...set], ['a']);
});

test('overlapWithLast: 前回との重複率を%で返す', () => {
  const log = [{ mode: 'am', ids: ['a', 'b', 'c', 'd'], at: 1 }];
  const pct = overlapWithLast(log, 'am', ['a', 'b', 'x', 'y']);
  assert.equal(pct, 50);
});

test('overlapWithLast: 前回の記録が無ければnull', () => {
  assert.equal(overlapWithLast([], 'am', ['a']), null);
});
