import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPomoRunning, isPomoRunning } from '../src/lib/runtimeFlags.js';

test('runtimeFlags: 既定はfalse', () => {
  assert.equal(isPomoRunning(), false);
});

test('runtimeFlags: setPomoRunningで値を切り替えられる', () => {
  setPomoRunning(true);
  assert.equal(isPomoRunning(), true);
  setPomoRunning(false);
  assert.equal(isPomoRunning(), false);
});

test('runtimeFlags: 真偽値以外を渡してもbooleanに正規化される', () => {
  setPomoRunning(1);
  assert.equal(isPomoRunning(), true);
  setPomoRunning(0);
  assert.equal(isPomoRunning(), false);
});
