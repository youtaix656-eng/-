import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, verifyPin, validatePin, weakHash } from '../src/lib/lock.js';

test('入力チェック（数字4〜8桁）', () => {
  assert.equal(validatePin('1234'), null);
  assert.ok(validatePin('12a4'));
  assert.ok(validatePin('123'));
  assert.ok(validatePin('123456789'));
});

test('暗証番号を平文で保存しない（変換した値が元と違う）', async () => {
  const { hash } = await hashPin('1234');
  assert.notEqual(hash, '1234');
  assert.ok(hash.length >= 16);
});

test('同じ番号なら同じ値、違う番号なら違う値', async () => {
  const a = await hashPin('4321');
  const b = await hashPin('4321');
  const c = await hashPin('4322');
  assert.equal(a.hash, b.hash);
  assert.notEqual(a.hash, c.hash);
});

test('照合できる。未設定なら誰でも開く', async () => {
  const { hash, kind } = await hashPin('9876');
  assert.equal(await verifyPin('9876', hash, kind), true);
  assert.equal(await verifyPin('9875', hash, kind), false);
  assert.equal(await verifyPin('', null, null), true);
});

test('簡易方式で設定した端末の値も照合できる（行き止まりにしない）', async () => {
  const legacy = weakHash('5555');
  assert.equal(await verifyPin('5555', legacy, 'fallback'), true);
  assert.equal(await verifyPin('5555', legacy, 'sha256'), true);
});
