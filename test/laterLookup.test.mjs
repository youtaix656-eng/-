import test from 'node:test';
import assert from 'node:assert/strict';
import { laterLookupCountSince } from '../src/lib/laterLookup.js';

test('laterLookupCountSince: 指定時刻以降の追加だけを数える', () => {
  const list = [{ at: 100 }, { at: 50 }, { at: 5 }];
  assert.equal(laterLookupCountSince(list, 10), 2);
});

test('laterLookupCountSince: 空配列・未指定は0件', () => {
  assert.equal(laterLookupCountSince([], 0), 0);
  assert.equal(laterLookupCountSince(undefined, 0), 0);
});
