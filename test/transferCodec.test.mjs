import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeTransferString, decodeTransferString } from '../src/lib/transferCodec.js';

test('encodeTransferString/decodeTransferString: 往復で元の文字列に戻る（日本語含む）', async () => {
  const text = JSON.stringify({ hello: 'こんにちは、鍼灸国試対策アプリ', n: 12345, arr: [1, 2, 3] });
  const enc = await encodeTransferString(text);
  const dec = await decodeTransferString(enc);
  assert.equal(dec, text);
});

test('encodeTransferString: 繰り返しの多いJSONは圧縮により旧方式より大幅に短くなる', async () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ id: `q-${i}`, correct: i % 2 === 0, at: 1700000000000 + i }));
  const text = JSON.stringify(items);
  const enc = await encodeTransferString(text);
  // 旧方式相当（encodeURIComponent + btoa）のサイズと比較
  const legacyLen = btoa(encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode('0x' + p))).length;
  assert.ok(enc.length < legacyLen, `圧縮後(${enc.length}) < 旧方式(${legacyLen})`);
});

test('decodeTransferString: 空文字はエラーになる', async () => {
  await assert.rejects(() => decodeTransferString(''));
});

test('encodeTransferString: 空オブジェクトなど短い文字列でも往復できる', async () => {
  const text = '{}';
  const enc = await encodeTransferString(text);
  const dec = await decodeTransferString(enc);
  assert.equal(dec, text);
});
