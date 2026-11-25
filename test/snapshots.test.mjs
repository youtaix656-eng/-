import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotateSnapshots, takeSnapshot, restoreSnapshot, MAX_SNAPSHOTS } from '../src/lib/backupSnapshots.js';

test('rotateSnapshots: 新しい世代を先頭に、max件で切り詰め', () => {
  let list = [];
  for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) list = rotateSnapshots(list, { id: String(i) });
  assert.equal(list.length, MAX_SNAPSHOTS);
  assert.equal(list[0].id, String(MAX_SNAPSHOTS + 2), '最新が先頭');
  assert.equal(list[list.length - 1].id, String(3), '古いものは押し出される');
});

test('rotateSnapshots: 復元を何度試しても、ふつうの世代は押し出されない（復元前は新しい3つまで）', () => {
  let list = [];
  for (let i = 0; i < 5; i++) list = rotateSnapshots(list, { id: `n${i}`, reason: '' });
  for (let i = 0; i < 10; i++) list = rotateSnapshots(list, { id: `r${i}`, reason: 'beforeRestore' });
  const normal = list.filter((s) => s.reason !== 'beforeRestore');
  const before = list.filter((s) => s.reason === 'beforeRestore');
  assert.equal(normal.length, 5);
  assert.equal(before.length, 3);
  assert.equal(before[0].id, 'r9');
});
