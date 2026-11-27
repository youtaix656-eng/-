import test from 'node:test';
import assert from 'node:assert/strict';
import { stampOf, pickNewerRaw } from '../src/lib/nativeMirror.js';

test('stampOf：オブジェクトは at、配列は中の at の最大、読めなければ0', () => {
  assert.equal(stampOf(JSON.stringify({ at: 5 })), 5);
  assert.equal(stampOf(JSON.stringify([{ at: 3 }, { at: 9 }])), 9);
  assert.equal(stampOf('こわれた'), 0);
});

test('pickNewerRaw：端末の控えの方が新しい時だけ戻す・片方しか無ければそれ', () => {
  const a = JSON.stringify({ index: 1, at: 10 });
  const b = JSON.stringify({ index: 7, at: 20 });
  assert.equal(pickNewerRaw(a, b), b);
  assert.equal(pickNewerRaw(b, a), b);
  assert.equal(pickNewerRaw(null, b), b);
  assert.equal(pickNewerRaw(a, null), a);
  assert.equal(pickNewerRaw(null, null), null);
});
