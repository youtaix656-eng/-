import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupFilename, parseBackup, serializeBackup } from '../src/lib/backup.js';
import { initialState } from '../src/lib/storage.js';
import { care, NOW, symptom } from './fixtures.js';

test('書き出したものをそのまま取り込める', () => {
  const st = { ...initialState(), symptoms: [symptom({ id: 'a' })], cares: [care({ id: 'k', symptomIds: ['a'] })] };
  const text = serializeBackup(st, NOW);
  const r = parseBackup(text);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.state.symptoms.length, 1);
    assert.equal(r.state.cares[0].symptomIds[0], 'a');
  }
});

test('読めないものは理由を返す（空のデータに置き換えない）', () => {
  assert.deepEqual(parseBackup('{'), { ok: false, reason: 'JSON として読めませんでした' });
  assert.equal(parseBackup('null').ok, false);
  assert.deepEqual(parseBackup('{"kind":"other"}'), { ok: false, reason: 'このアプリの書き出しファイルではありません' });
});

test('ファイル名は日付つき', () => {
  assert.equal(backupFilename('2026-09-12'), 'taicho-karte-2026-09-12.json');
});
