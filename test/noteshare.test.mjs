import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeNotes, decodeNotes, readSeedFromHash } from '../src/lib/noteshare.js';

test('日本語を含むメモを round-trip できる', () => {
  const notes = [
    { category: 'self', title: 'テスト見出し①', body: '日本語の本文をふくむ内容。改行\nも確認。' },
    { category: 'pass', title: '合格メモ', body: '毎日1問。' },
  ];
  const enc = encodeNotes(notes);
  assert.ok(!/[+/=]/.test(enc), 'base64url に + / = を含まない');
  const dec = decodeNotes(enc);
  assert.deepEqual(dec, notes);
});

test('readSeedFromHash: #notes= から取り出す', () => {
  const notes = [{ category: 'self', title: 'あ', body: 'い' }];
  const enc = encodeNotes(notes);
  assert.deepEqual(readSeedFromHash(`#notes=${enc}`), notes);
  assert.deepEqual(readSeedFromHash(`#foo=1&notes=${enc}`), notes);
});

test('readSeedFromHash: 無ければ null、壊れていても安全', () => {
  assert.equal(readSeedFromHash(''), null);
  assert.equal(readSeedFromHash('#other=1'), null);
  assert.equal(readSeedFromHash('#notes=@@invalid@@'), null);
});
