import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendMigrationMethod } from '../src/lib/migrationAdvice.js';

test('recommendMigrationMethod: 小さいペイロードはQR1枚をすすめる', () => {
  const r = recommendMigrationMethod({ syncPayloadBytes: 1200, fullBackupBytes: 5000, hasShareApi: false });
  assert.equal(r.id, 'qr');
});

test('recommendMigrationMethod: 中くらいは分割QRをすすめる', () => {
  const r = recommendMigrationMethod({ syncPayloadBytes: 20_000, fullBackupBytes: 100_000, hasShareApi: false });
  assert.equal(r.id, 'qr-multi');
});

test('recommendMigrationMethod: 大きくて共有API対応なら共有ボタンをすすめる', () => {
  const r = recommendMigrationMethod({ syncPayloadBytes: 200_000, fullBackupBytes: 5_000_000, hasShareApi: true });
  assert.equal(r.id, 'share');
});

test('recommendMigrationMethod: 大きくて共有API非対応ならWebRTCをすすめる', () => {
  const r = recommendMigrationMethod({ syncPayloadBytes: 200_000, fullBackupBytes: 5_000_000, hasShareApi: false });
  assert.equal(r.id, 'webrtc');
});

test('recommendMigrationMethod: 極端に大きい場合はバックアップファイルをすすめる', () => {
  const r = recommendMigrationMethod({ syncPayloadBytes: 200_000, fullBackupBytes: 50_000_000, hasShareApi: false });
  assert.equal(r.id, 'file');
});

test('recommendMigrationMethod: サイズ不明でも共有API対応なら共有をすすめる', () => {
  const r = recommendMigrationMethod({ syncPayloadBytes: null, fullBackupBytes: null, hasShareApi: true });
  assert.equal(r.id, 'share');
});
