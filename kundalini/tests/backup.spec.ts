import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, backupFilename, BACKUP_KIND } from '../src/lib/backup.js';
import { normalizeState } from '../src/lib/storage.js';
import { initialState } from '../src/lib/useStore.js';
import { testState, relapse, DAY } from './fixtures.js';

const NOW = new Date(2026, 8, 10, 12, 0, 0).getTime();

test('書き出しに暗証番号を含めない', () => {
  const state = testState({ settings: { pinHash: 'abc', pinKind: 'sha256' } as never });
  const file = buildBackup(state, NOW);
  assert.equal(file.state.settings.pinHash, null);
  assert.equal(file.state.settings.pinKind, null);
  assert.equal(file.kind, BACKUP_KIND);
});

test('記録は書き出しに残る', () => {
  const state = testState({ startedAt: NOW - 3 * DAY, relapses: [relapse(NOW - 9 * DAY, NOW - 3 * DAY)] });
  const file = buildBackup(state, NOW);
  assert.equal(file.state.relapses.length, 1);
  assert.equal(file.state.startedAt, NOW - 3 * DAY);
});

test('読めないファイルは理由を日本語で返す（黙って失敗しない）', () => {
  const broken = parseBackup('{');
  assert.equal(broken.ok, false);
  if (!broken.ok) assert.match(broken.reason, /[ぁ-んァ-ン一-龥]/);
  const other = parseBackup(JSON.stringify({ kind: 'something-else' }));
  assert.equal(other.ok, false);
});

test('往復できる', () => {
  const state = testState({ startedAt: NOW - DAY });
  const text = JSON.stringify(buildBackup(state, NOW));
  const parsed = parseBackup(text);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(normalizeState(parsed.file.state, initialState()).startedAt, NOW - DAY);
});

test('外から来た壊れたデータを通しても落ちない', () => {
  const s = normalizeState({ days: { 'x': null }, relapses: [{ at: 1 }], urges: null } as never, initialState());
  assert.deepEqual(s.days, {});
  assert.deepEqual(s.relapses, []);
  assert.deepEqual(s.urges, []);
  assert.equal(s.startedAt, null);
});

test('ファイル名に日付が入る', () => {
  assert.equal(backupFilename(NOW), 'kundalini-20260910.json');
});
