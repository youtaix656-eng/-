import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchUrl,
  buildMultipartBody,
  buildUploadUrl,
  buildDownloadUrl,
  BACKUP_FILENAME,
  DRIVE_SCOPE,
} from '../src/lib/googleDrive.js';

test('buildSearchUrl: appDataFolder内をファイル名で検索するクエリを組み立てる', () => {
  const url = buildSearchUrl();
  assert.ok(url.includes('spaces=appDataFolder'));
  assert.ok(url.includes(encodeURIComponent(`name='${BACKUP_FILENAME}' and trashed=false`)));
});

test('buildSearchUrl: シングルクォートを含むファイル名でも壊れない', () => {
  const url = buildSearchUrl("a'b.json");
  assert.ok(url.includes(encodeURIComponent("name='a\\'b.json' and trashed=false")));
});

test('buildMultipartBody: メタデータ・本文をmultipart/related形式で組み立てる', () => {
  const body = buildMultipartBody({ name: 'x.json' }, '{"a":1}', 'BOUND');
  assert.ok(body.startsWith('--BOUND\r\n'));
  assert.ok(body.includes('Content-Type: application/json; charset=UTF-8'));
  assert.ok(body.includes('{"name":"x.json"}'));
  assert.ok(body.includes('{"a":1}'));
  assert.ok(body.endsWith('--BOUND--'));
});

test('buildUploadUrl: 既存ファイルIDの有無でPOST先/PATCH先が変わる', () => {
  const createUrl = buildUploadUrl(null);
  const updateUrl = buildUploadUrl('file123');
  assert.ok(createUrl.includes('uploadType=multipart'));
  assert.ok(!createUrl.includes('file123'));
  assert.ok(updateUrl.includes('/file123'));
});

test('buildDownloadUrl: alt=media でファイル本体を取得するURLを組み立てる', () => {
  const url = buildDownloadUrl('file123');
  assert.ok(url.includes('/file123'));
  assert.ok(url.includes('alt=media'));
});

test('DRIVE_SCOPE は appdata スコープのみ（通常のDriveファイルへはアクセスしない）', () => {
  assert.equal(DRIVE_SCOPE, 'https://www.googleapis.com/auth/drive.appdata');
});
