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
  summarizeHistoryForTransfer,
  HISTORY_SUMMARY_CUTOFF_MS,
  SYNC_TTL_MS,
} from '../src/lib/sync.js';

// 受け渡し（QR/URL）→ 取り込みの往復。QRスキャンはこの経路にエンコード値を渡すだけなので、
// ここが通れば「読み取り→取り込み」も同じ結果になる。
test('進捗データを encode → decode で round-trip できる', async () => {
  const data = {
    srs: { 'q-1': { seen: 3, ease: 2.4 }, 'q-2': { seen: 1 } },
    history: [{ id: 'q-1', correct: true, t: 111 }],
    memos: { 'q-1': 'メモ①' },
    links: { 顔面神経: ['q-1'] },
    examResults: [{ score: 82, total: 100 }],
    settings: { sessionNewRatio: 0.5, examDate: '2027-02-28' },
  };
  const enc = await encodeSync(buildSyncPayload(data, { includeHistory: true }));
  assert.ok(!/[+/=]/.test(enc), 'base64url に + / = を含まない');
  const back = syncToBackup(await decodeSync(enc));
  assert.deepEqual(back.srs, data.srs);
  assert.deepEqual(back.history, data.history);
  assert.deepEqual(back.memos, data.memos);
  assert.deepEqual(back.links, data.links);
  assert.deepEqual(back.examResults, data.examResults);
  assert.deepEqual(back.settings, data.settings);
});

test('解答履歴を含めない指定は history を落とす', async () => {
  const data = { srs: { a: { seen: 1 } }, history: [{ id: 'a' }] };
  const enc = await encodeSync(buildSyncPayload(data, { includeHistory: false }));
  const back = syncToBackup(await decodeSync(enc));
  assert.equal(back.history, undefined);
  assert.deepEqual(back.srs, data.srs);
});

test('extractSyncCode は URL/文字列から #sync= の値を取り出す', async () => {
  const enc = await encodeSync(buildSyncPayload({ srs: { a: { seen: 1 } } }));
  const url = `https://youtaix656-eng.github.io/-/#sync=${enc}`;
  assert.equal(extractSyncCode(url), enc, 'ハッシュ付きURLから抽出');
  assert.equal(extractSyncCode(`app://x/?foo=1&sync=${enc}`), enc, 'クエリ形式からも抽出');
  assert.equal(extractSyncCode('https://example.com/'), '', '受け渡し用でないURLは空');
  assert.equal(extractSyncCode('ただのテキスト'), '', '無関係な文字列は空');
  assert.equal(extractSyncCode(''), '', '空入力は空');
});

test('抽出した値をそのまま decode でき、往復が一致する', async () => {
  const data = { srs: { 'q-9': { seen: 5 } }, memos: { 'q-9': 'かくにん' } };
  const enc = await encodeSync(buildSyncPayload(data));
  const url = `https://youtaix656-eng.github.io/-/#sync=${enc}`;
  const picked = extractSyncCode(url);
  const back = syncToBackup(await decodeSync(decodeURIComponent(picked)));
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

test('decodeSync は未対応バージョンを弾く', async () => {
  const badEnc = await encodeSync({ v: 2, s: {} });
  await assert.rejects(() => decodeSync(badEnc), /未対応/);
});

test('summarizeHistoryForTransfer: 直近90日はそのまま、それより前は日×科目×正誤で集計', () => {
  const now = Date.now();
  const recentAt = now - 1 * 24 * 60 * 60 * 1000; // 1日前（要約対象外）
  const oldDay = '2020-01-01';
  const oldAt = new Date(`${oldDay}T09:00:00.000Z`).getTime(); // 90日超過（要約対象）
  const history = [
    { questionId: 'q-recent', subject: '解剖学', correct: true, at: recentAt },
    { questionId: 'q-old-1', subject: '解剖学', correct: true, at: oldAt },
    { questionId: 'q-old-2', subject: '解剖学', correct: true, at: oldAt + 1000 },
    { questionId: 'q-old-3', subject: '解剖学', correct: false, at: oldAt + 2000 },
    { questionId: 'q-old-4', subject: '生理学', correct: true, at: oldAt + 3000 },
  ];
  const out = summarizeHistoryForTransfer(history, now);
  // 直近1件はそのまま残る
  assert.ok(out.some((e) => e.questionId === 'q-recent'));
  // 古い5件のうち4件は3バケット（解剖学×正, 解剖学×誤, 生理学×正）に集約される
  const aggregated = out.filter((e) => e.n != null);
  assert.equal(aggregated.length, 3);
  const anatCorrect = aggregated.find((e) => e.subject === '解剖学' && e.correct === true);
  assert.equal(anatCorrect.n, 2);
  const anatWrong = aggregated.find((e) => e.subject === '解剖学' && e.correct === false);
  assert.equal(anatWrong.n, 1);
  // 集約後の件数（1件の直近 + 3バケット）は元の5件より少ない
  assert.equal(out.length, 4);
});

test('summarizeHistoryForTransfer: 90日以内のデータだけなら要約せずそのまま', () => {
  const now = Date.now();
  const history = [
    { questionId: 'a', subject: 'X', correct: true, at: now - 1000 },
    { questionId: 'b', subject: 'X', correct: false, at: now - 2000 },
  ];
  const out = summarizeHistoryForTransfer(history, now);
  assert.equal(out.length, 2);
  assert.ok(out.every((e) => e.n == null));
});

test('buildSyncPayload: summarizeHistory オプションで履歴が圧縮される', async () => {
  const now = Date.now();
  const oldAt = now - (HISTORY_SUMMARY_CUTOFF_MS + 10 * 24 * 60 * 60 * 1000);
  const history = Array.from({ length: 30 }, (_, i) => ({
    questionId: `q-${i}`,
    subject: '解剖学',
    correct: i % 2 === 0,
    at: oldAt + i * 1000,
  }));
  const raw = buildSyncPayload({ history }, { includeHistory: true, summarizeHistory: false });
  const summarized = buildSyncPayload({ history }, { includeHistory: true, summarizeHistory: true });
  assert.equal(raw.h.length, 30);
  assert.ok(summarized.h.length < raw.h.length);
  // 要約後も往復できる（decodeSync が読める形のまま）
  const back = syncToBackup(await decodeSync(await encodeSync(summarized)));
  assert.ok(Array.isArray(back.history));
});
