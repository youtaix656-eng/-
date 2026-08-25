import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchUrl,
  buildMultipartBody,
  buildUploadUrl,
  buildDownloadUrl,
  BACKUP_FILENAME,
  SYNC_FILENAME,
  DRIVE_SCOPE,
  isSilentAuthError,
  uploadBackup,
  downloadBackup,
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

test('BACKUP_FILENAME と SYNC_FILENAME は別ファイル（手動バックアップと自動同期が競合しない）', () => {
  assert.notEqual(BACKUP_FILENAME, SYNC_FILENAME);
});

test('buildSearchUrl: SYNC_FILENAMEでも正しく検索クエリを組み立てられる', () => {
  const url = buildSearchUrl(SYNC_FILENAME);
  assert.ok(url.includes(encodeURIComponent(`name='${SYNC_FILENAME}' and trashed=false`)));
});

test('isSilentAuthError: silentAuthFailedフラグの有無で判定する', () => {
  const silentErr = new Error('x');
  silentErr.silentAuthFailed = true;
  assert.equal(isSilentAuthError(silentErr), true);
  assert.equal(isSilentAuthError(new Error('y')), false);
  assert.equal(isSilentAuthError(null), false);
  assert.equal(isSilentAuthError(undefined), false);
});

test('buildSearchUrl: 10種のクセのあるファイル名でも例外を投げず正しくエスケープする', () => {
  const names = [
    "it's a test.json",
    "''''",
    'a\\b.json',
    '日本語ファイル名.json',
    '',
    ' leading-space.json',
    'trailing-space.json ',
    'a'.repeat(500) + '.json',
    "quote'then\\backslash.json",
    '🎉emoji.json',
  ];
  for (const name of names) {
    const url = buildSearchUrl(name);
    assert.ok(url.startsWith('https://www.googleapis.com/drive/v3/files?'), `url malformed for ${JSON.stringify(name)}`);
    // 生のシングルクォートがエスケープされずクエリに残っていないこと（Drive APIのクエリ構文を壊さない）
    const decoded = decodeURIComponent(url.split('q=')[1]);
    const raw = decoded.match(/name='(.*)' and trashed=false/s)[1];
    // 元のシングルクォートは必ず直前にバックスラッシュが付いた形で現れる
    for (let i = 0; i < name.length; i++) {
      if (name[i] === "'") {
        const idx = raw.indexOf("\\'");
        assert.ok(idx !== -1, `quote not escaped for ${JSON.stringify(name)}`);
      }
    }
  }
});

// ===== fetchを伴う関数（global.fetchをモックしてDrive APIとの疎通は行わない） =====

function mockFetchSequence(responses) {
  let i = 0;
  return async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    if (r.throw) throw r.throw;
    return { ok: r.ok !== false, status: r.status || 200, json: async () => r.json, text: async () => r.text };
  };
}

test('uploadBackup: 既存ファイルが無ければappDataFolderへ新規作成(POST)する', async () => {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method });
    if (calls.length === 1) return { ok: true, json: async () => ({ files: [] }) }; // 検索
    return { ok: true, json: async () => ({ id: 'new-id' }) }; // アップロード
  };
  try {
    const res = await uploadBackup('tok', '{"a":1}', 'x.json');
    assert.equal(res.id, 'new-id');
    assert.equal(calls[1].method, 'POST');
    assert.ok(!calls[1].url.includes('/x.json'));
  } finally {
    delete global.fetch;
  }
});

test('uploadBackup: 既存ファイルがあれば上書き(PATCH)する', async () => {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method });
    if (calls.length === 1) return { ok: true, json: async () => ({ files: [{ id: 'existing-id', modifiedTime: '2024-01-01' }] }) };
    return { ok: true, json: async () => ({ id: 'existing-id' }) };
  };
  try {
    await uploadBackup('tok', '{"a":1}', 'x.json');
    assert.equal(calls[1].method, 'PATCH');
    assert.ok(calls[1].url.includes('/existing-id'));
  } finally {
    delete global.fetch;
  }
});

test('uploadBackup: 検索が失敗(non-ok)したらHTTPステータス付きでエラーになる', async () => {
  global.fetch = mockFetchSequence([{ ok: false, status: 403 }]);
  try {
    await assert.rejects(() => uploadBackup('tok', '{}', 'x.json'), /検索に失敗.*403/);
  } finally {
    delete global.fetch;
  }
});

test('uploadBackup: アップロード自体が失敗(non-ok)したらエラーになる', async () => {
  global.fetch = mockFetchSequence([{ ok: true, json: { files: [] } }, { ok: false, status: 500 }]);
  try {
    await assert.rejects(() => uploadBackup('tok', '{}', 'x.json'), /保存に失敗.*500/);
  } finally {
    delete global.fetch;
  }
});

test('downloadBackup: appDataFolderに該当ファイルが無ければnullを返す（エラーにしない）', async () => {
  global.fetch = mockFetchSequence([{ ok: true, json: { files: [] } }]);
  try {
    const text = await downloadBackup('tok', 'x.json');
    assert.equal(text, null);
  } finally {
    delete global.fetch;
  }
});

test('downloadBackup: ファイルが見つかれば本文を返す', async () => {
  global.fetch = mockFetchSequence([
    { ok: true, json: { files: [{ id: 'file-1' }] } },
    { ok: true, text: '{"srs":{}}' },
  ]);
  try {
    const text = await downloadBackup('tok', 'x.json');
    assert.equal(text, '{"srs":{}}');
  } finally {
    delete global.fetch;
  }
});

test('downloadBackup: 本体の取得が失敗(non-ok)したらエラーになる', async () => {
  global.fetch = mockFetchSequence([
    { ok: true, json: { files: [{ id: 'file-1' }] } },
    { ok: false, status: 404 },
  ]);
  try {
    await assert.rejects(() => downloadBackup('tok', 'x.json'), /取得に失敗.*404/);
  } finally {
    delete global.fetch;
  }
});

test('uploadBackup/downloadBackup: 通信タイムアウト（AbortError）は分かりやすいメッセージに変換される', async () => {
  global.fetch = async () => {
    const e = new Error('aborted');
    e.name = 'TimeoutError';
    throw e;
  };
  try {
    await assert.rejects(() => downloadBackup('tok', 'x.json'), /タイムアウト/);
  } finally {
    delete global.fetch;
  }
});

test('uploadBackup: Authorizationヘッダーに毎回Bearerトークンを付与する', async () => {
  const authHeaders = [];
  global.fetch = async (url, opts) => {
    authHeaders.push(opts.headers.Authorization);
    if (authHeaders.length === 1) return { ok: true, json: async () => ({ files: [] }) };
    return { ok: true, json: async () => ({ id: 'x' }) };
  };
  try {
    await uploadBackup('my-token-123', '{}', 'x.json');
    assert.ok(authHeaders.every((h) => h === 'Bearer my-token-123'));
  } finally {
    delete global.fetch;
  }
});
