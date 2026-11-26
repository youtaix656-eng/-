import test from 'node:test';
import assert from 'node:assert/strict';
import { collectUrlChunk, buildSyncPayload, syncToBackup, URL_CHUNK_KEY } from '../src/lib/sync.js';
import { splitIntoChunks } from '../src/lib/chunk.js';
import { mergeProgress, syncChangeTimes, progressChanged } from '../src/lib/progressMerge.js';

const memStore = () => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), remove: (k) => m.delete(k), m }; };

test('アプリが出す1枚の分割形式のURLを読める', () => {
  const { parts } = splitIntoChunks('1ABCdef_-', 1000);
  assert.deepEqual(collectUrlChunk(parts[0], memStore()), { encoded: '1ABCdef_-' });
});

test('分割していない古い形式はそのまま', () => {
  assert.deepEqual(collectUrlChunk('1XYZ', memStore()), { encoded: '1XYZ' });
});

test('複数枚は端末の中に集めて、揃ったら順に組み立てる（順不同）', () => {
  const { parts } = splitIntoChunks('aaaabbbbcccc', 4);
  const st = memStore();
  assert.deepEqual(collectUrlChunk(parts[2], st), { partial: { received: 1, total: 3 } });
  assert.deepEqual(collectUrlChunk(parts[0], st), { partial: { received: 2, total: 3 } });
  assert.deepEqual(collectUrlChunk(parts[1], st), { encoded: 'aaaabbbbcccc' });
  assert.equal(st.get(URL_CHUNK_KEY), null);
});

test('別の転送のQRが来たら集め直す', () => {
  const a = splitIntoChunks('aaaabbbb', 4).parts;
  const b = splitIntoChunks('ccccdddd', 4).parts;
  const st = memStore();
  collectUrlChunk(a[0], st);
  assert.deepEqual(collectUrlChunk(b[1], st), { partial: { received: 1, total: 2 } });
  assert.deepEqual(collectUrlChunk(b[0], st), { encoded: 'ccccdddd' });
});

test('QRの受け渡しに語呂合わせが入る', () => {
  const p = buildSyncPayload({ kwMeta: { 語: { mnemonic: 'ごろ' } } });
  assert.deepEqual(syncToBackup(p).kwMeta, { 語: { mnemonic: 'ごろ' } });
});

test('クラウドのマージで語呂合わせを両方残す', () => {
  const m = mergeProgress({ kwMeta: { a: { mnemonic: 'A' } } }, { kwMeta: { b: { mnemonic: 'B' } } });
  assert.deepEqual(Object.keys(m.kwMeta).sort(), ['a', 'b']);
  assert.equal(progressChanged({ kwMeta: { a: { mnemonic: 'A' } } }, m), true);
});

test('新しさは同期の時刻ではなく記録を変えた時刻で比べる', () => {
  // この端末：最後の同期100・そのあと300に編集。別の端末：200に同期（変更は150）
  const t = syncChangeTimes({ updatedAt: 100 }, 300, { updatedAt: 200, changedAt: 150 });
  assert.equal(t.localUpdatedAt > t.remoteUpdatedAt, true);
  assert.equal(t.changedAt, 300);
  const merged = mergeProgress({ memos: { q: '新しい' } }, { memos: { q: '古い' } }, t);
  assert.equal(merged.memos.q, '新しい');
  // 変更時刻を持たない古い記録は同期の時刻で比べる
  const old = syncChangeTimes({ updatedAt: 100 }, 0, { updatedAt: 200 });
  assert.equal(old.remoteUpdatedAt > old.localUpdatedAt, true);
});

import { keepSeedFlags, isSeedFlagKey } from '../src/lib/storage.js';

test('問題を持ってこない受け渡しでは、問題を追加した印をこの端末のまま残す', () => {
  const incoming = { dailyGoal: 77, eiseiVersion: 99, iryouSeeded: true, mnemonicsVersion: 5, weatherDefaultsVersion: 2 };
  const current = { dailyGoal: 5, eiseiVersion: 10 };
  const out = keepSeedFlags(incoming, current);
  assert.equal(out.dailyGoal, 77);
  assert.equal(out.eiseiVersion, 10);
  assert.equal('iryouSeeded' in out, false); // この端末にはまだ無い＝次の起動で入れる
  assert.equal(out.mnemonicsVersion, 5); // 語呂合わせの印は語呂合わせと一緒に動く
  assert.equal(out.weatherDefaultsVersion, 2);
  assert.equal(isSeedFlagKey('anatVersion'), true);
  assert.equal(isSeedFlagKey('mnemonicsVersion'), false);
});
