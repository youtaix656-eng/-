import test from 'node:test';
import assert from 'node:assert/strict';
import { rephraseCountSince } from '../src/lib/rephraseLog.js';

test('rephraseCountSince: 指定時刻以降の発生だけを数える', () => {
  const log = [{ questionId: 'q-1', at: 100 }, { questionId: 'q-2', at: 50 }];
  assert.equal(rephraseCountSince(log, 60), 1);
});

test('rephraseCountSince: 空配列・未指定は0件', () => {
  assert.equal(rephraseCountSince([], 0), 0);
  assert.equal(rephraseCountSince(undefined, 0), 0);
});
