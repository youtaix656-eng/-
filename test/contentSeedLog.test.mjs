import test from 'node:test';
import assert from 'node:assert/strict';
import { lastUpdateBySubject, latestSeedEntry, seedEntriesSince } from '../src/lib/contentSeedLog.js';

test('lastUpdateBySubject: 科目ごとに最新の追加日時と累計を集計する', () => {
  const log = [
    { at: 200, bySubject: [{ subject: 'A', count: 3 }] },
    { at: 100, bySubject: [{ subject: 'A', count: 5 }, { subject: 'B', count: 2 }] },
  ];
  const map = lastUpdateBySubject(log);
  assert.equal(map.get('A').at, 200);
  assert.equal(map.get('A').totalAdded, 8);
  assert.equal(map.get('B').at, 100);
});

test('latestSeedEntry: 先頭（最新）の1件を返す', () => {
  const log = [{ at: 200 }, { at: 100 }];
  assert.equal(latestSeedEntry(log).at, 200);
});

test('latestSeedEntry: 空なら null', () => {
  assert.equal(latestSeedEntry([]), null);
  assert.equal(latestSeedEntry(undefined), null);
});

test('seedEntriesSince: 基準時刻以降のログだけ返す', () => {
  const log = [{ at: 300 }, { at: 100 }];
  const result = seedEntriesSince(log, 200);
  assert.equal(result.length, 1);
  assert.equal(result[0].at, 300);
});
