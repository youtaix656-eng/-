import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBackupText } from '../src/lib/backupText.js';
import { backupFileName } from '../src/lib/download.js';

test('BOMや前後の空白があっても読める', () => {
  const d = parseBackupText('﻿  {"srs":{},"history":[1]}\n');
  assert.deepEqual(d.history, [1]);
});
test('空・壊れた・別物のファイルは理由つきで断る', () => {
  assert.throws(() => parseBackupText(''), /空/);
  assert.throws(() => parseBackupText('{abc'), /読み取れません/);
  assert.throws(() => parseBackupText('[1,2]'), /ではない/);
  assert.throws(() => parseBackupText('{"foo":1}'), /このアプリのバックアップではない/);
});
test('ファイル名は端末の日付（UTCで前日にならない）', () => {
  assert.equal(backupFileName(new Date(2026, 10, 23, 1, 0)), 'shinkyu_backup_2026-11-23.json');
});
