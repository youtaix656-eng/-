import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitIntoChunks, parseChunk, Reassembler } from '../src/lib/chunk.js';

test('splitIntoChunks/parseChunk: 分割・パースの往復', () => {
  const data = 'A'.repeat(25);
  const { transferId, parts } = splitIntoChunks(data, 10);
  assert.equal(parts.length, 3);
  for (const p of parts) {
    const parsed = parseChunk(p);
    assert.ok(parsed);
    assert.equal(parsed.transferId, transferId);
    assert.equal(parsed.of, 3);
  }
});

test('parseChunk: 形式が違う文字列は null', () => {
  assert.equal(parseChunk('not a chunk'), null);
  assert.equal(parseChunk(''), null);
  assert.equal(parseChunk('abc.0.3.xyz'), null); // part=0は不正
});

test('Reassembler: 順不同で投入しても揃えば組み立てられる', () => {
  const data = '0' + 'B'.repeat(37);
  const { parts } = splitIntoChunks(data, 10);
  const shuffled = [parts[2], parts[0], parts[3], parts[1]];
  const r = new Reassembler();
  let last;
  for (const p of shuffled) last = r.add(p);
  assert.equal(last.complete, true);
  assert.equal(r.assemble(), data);
});

test('Reassembler: 重複投入しても壊れない', () => {
  const data = '0' + 'C'.repeat(15);
  const { parts } = splitIntoChunks(data, 10);
  const r = new Reassembler();
  r.add(parts[0]);
  r.add(parts[0]);
  const res = r.add(parts[1]);
  assert.equal(res.receivedCount, 2);
  assert.equal(res.complete, true);
  assert.equal(r.assemble(), data);
});

test('Reassembler: 途中経過（不足分）とmissingPartsが正しい', () => {
  const data = '0' + 'D'.repeat(35);
  const { parts } = splitIntoChunks(data, 10);
  const r = new Reassembler();
  r.add(parts[0]);
  r.add(parts[2]);
  assert.equal(r.assemble(), null);
  assert.deepEqual(r.missingParts, [2, 4]);
});

test('Reassembler: 別のtransferIdが来たら古い断片を破棄して新しく集め直す', () => {
  const dataA = '0' + 'E'.repeat(25);
  const dataB = '0' + 'F'.repeat(15);
  const a = splitIntoChunks(dataA, 10);
  const b = splitIntoChunks(dataB, 10);
  const r = new Reassembler();
  r.add(a.parts[0]);
  const res = r.add(b.parts[0]);
  assert.equal(res.isNewTransfer, true);
  r.add(b.parts[1]);
  assert.equal(r.assemble(), dataB);
});

test('splitIntoChunks: 1チャンクで収まる場合はof=1', () => {
  const { parts } = splitIntoChunks('short', 100);
  assert.equal(parts.length, 1);
  assert.equal(parseChunk(parts[0]).of, 1);
});
