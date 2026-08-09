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
