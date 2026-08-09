import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSyncPayload,
  encodeSync,
  decodeSync,
  syncToBackup,
  isSyncExpired,
  syncAgeMs,
  extractSyncCode,
  SYNC_TTL_MS,
} from '../src/lib/sync.js';

// 受け渡し（QR/URL）→ 取り込みの往復。QRスキャンはこの経路にエンコード値を渡すだけなので、
// ここが通れば「読み取り→取り込み」も同じ結果になる。
test('進捗データを encode → decode で round-trip できる', () => {
  const data = {
    srs: { 'q-1': { seen: 3, ease: 2.4 }, 'q-2': { seen: 1 } },
    history: [{ id: 'q-1', correct: true, t: 111 }],
    memos: { 'q-1': 'メモ①' },
    links: { 顔面神経: ['q-1'] },
    examResults: [{ score: 82, total: 100 }],
    settings: { sessionNewRatio: 0.5, examDate: '2027-02-28' },
  };
  const enc = encodeSync(buildSyncPayload(data, { includeHistory: true }));
  assert.ok(!/[+/=]/.test(enc), 'base64url に + / = を含まない');
  const back = syncToBackup(decodeSync(enc));
  assert.deepEqual(back.srs, data.srs);
  assert.deepEqual(back.history, data.history);
  assert.deepEqual(back.memos, data.memos);
  assert.deepEqual(back.links, data.links);
  assert.deepEqual(back.examResults, data.examResults);
  assert.deepEqual(back.settings, data.settings);
});

test('解答履歴を含めない指定は history を落とす', () => {
  const data = { srs: { a: { seen: 1 } }, history: [{ id: 'a' }] };
  const back = syncToBackup(decodeSync(encodeSync(buildSyncPayload(data, { includeHistory: false }))));
  assert.equal(back.history, undefined);
  assert.deepEqual(back.srs, data.srs);
});

test('extractSyncCode は URL/文字列から #sync= の値を取り出す', () => {
  const enc = encodeSync(buildSyncPayload({ srs: { a: { seen: 1 } } }));
  const url = `https://youtaix656-eng.github.io/-/#sync=${enc}`;
  assert.equal(extractSyncCode(url), enc, 'ハッシュ付きURLから抽出');
  assert.equal(extractSyncCode(`app://x/?foo=1&sync=${enc}`), enc, 'クエリ形式からも抽出');
  assert.equal(extractSyncCode('https://example.com/'), '', '受け渡し用でないURLは空');
  assert.equal(extractSyncCode('ただのテキスト'), '', '無関係な文字列は空');
  assert.equal(extractSyncCode(''), '', '空入力は空');
});

test('抽出した値をそのまま decode でき、往復が一致する', () => {
  const data = { srs: { 'q-9': { seen: 5 } }, memos: { 'q-9': 'かくにん' } };
  const enc = encodeSync(buildSyncPayload(data));
  const url = `https://youtaix656-eng.github.io/-/#sync=${enc}`;
  const picked = extractSyncCode(url);
  const back = syncToBackup(decodeSync(decodeURIComponent(picked)));
  assert.deepEqual(back.srs, data.srs);
  assert.deepEqual(back.memos, data.memos);
});

test('5分以内は有効、5分超は期限切れ扱い', () => {
  const fresh = buildSyncPayload({ srs: { a: { seen: 1 } } });
  assert.equal(isSyncExpired(fresh), false, '発行直後は有効');
  // t を過去（6分前）に差し替えて期限切れを再現
  const stale = { ...fresh, t: Math.floor((Date.now() - (SYNC_TTL_MS + 60_000)) / 1000) };
  assert.equal(isSyncExpired(stale), true, '5分超は期限切れ');
  assert.ok(syncAgeMs(stale) > SYNC_TTL_MS);
});

test('t の無い旧データは期限切れにしない', () => {
  const legacy = { v: 1, s: { a: { seen: 1 } } };
  assert.equal(syncAgeMs(legacy), null);
  assert.equal(isSyncExpired(legacy), false);
});

test('decodeSync は未対応バージョンを弾く', () => {
  const badEnc = encodeSync({ v: 2, s: {} });
  assert.throws(() => decodeSync(badEnc), /未対応/);
});
