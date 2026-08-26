import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloneVoice, synthesizeSpeech, deleteVoice } from '../src/lib/voiceClone.js';

function mockFetchOnce(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => { globalThis.fetch = original; };
}

test('cloneVoice: APIキー未設定はエラー', async () => {
  await assert.rejects(() => cloneVoice({ apiKey: '', name: 'x', blob: new Blob(['a']) }), /APIキー/);
});

test('cloneVoice: 音声ファイル未指定はエラー', async () => {
  await assert.rejects(() => cloneVoice({ apiKey: 'k', name: 'x', blob: null }), /音声ファイル/);
});

test('cloneVoice: 成功時はvoiceIdを返し、xi-api-keyヘッダとmultipartボディを送る', async () => {
  let capturedUrl, capturedInit;
  const restore = mockFetchOnce(async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return {
      ok: true,
      json: async () => ({ voice_id: 'abc123' }),
    };
  });
  try {
    const { voiceId } = await cloneVoice({ apiKey: 'my-key', name: 'マイボイス', blob: new Blob(['data']), fileName: 'sample.wav' });
    assert.equal(voiceId, 'abc123');
    assert.equal(capturedUrl, 'https://api.elevenlabs.io/v1/voices/add');
    assert.equal(capturedInit.method, 'POST');
    assert.equal(capturedInit.headers['xi-api-key'], 'my-key');
    assert.ok(capturedInit.body instanceof FormData);
  } finally {
    restore();
  }
});

test('cloneVoice: APIがエラーを返したら例外を投げる', async () => {
  const restore = mockFetchOnce(async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({ detail: { message: 'invalid api key' } }),
  }));
  try {
    await assert.rejects(
      () => cloneVoice({ apiKey: 'bad', name: 'x', blob: new Blob(['a']) }),
      /invalid api key/
    );
  } finally {
    restore();
  }
});

test('cloneVoice: voice_idが返らない場合もエラー', async () => {
  const restore = mockFetchOnce(async () => ({ ok: true, json: async () => ({}) }));
  try {
    await assert.rejects(() => cloneVoice({ apiKey: 'k', name: 'x', blob: new Blob(['a']) }), /voice_id/);
  } finally {
    restore();
  }
});

test('synthesizeSpeech: 必須パラメータ欠落はエラー', async () => {
  await assert.rejects(() => synthesizeSpeech({ apiKey: '', voiceId: 'v', text: 't' }), /APIキー/);
  await assert.rejects(() => synthesizeSpeech({ apiKey: 'k', voiceId: '', text: 't' }), /ボイスID/);
  await assert.rejects(() => synthesizeSpeech({ apiKey: 'k', voiceId: 'v', text: '' }), /テキスト/);
});

test('synthesizeSpeech: 成功時はBlobを返し、正しいエンドポイント・ヘッダで呼ぶ', async () => {
  let capturedUrl, capturedInit;
  const fakeBlob = new Blob(['audio-bytes'], { type: 'audio/mpeg' });
  const restore = mockFetchOnce(async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return { ok: true, blob: async () => fakeBlob };
  });
  try {
    const blob = await synthesizeSpeech({ apiKey: 'k', voiceId: 'v1', text: 'こんにちは' });
    assert.equal(blob, fakeBlob);
    assert.equal(capturedUrl, 'https://api.elevenlabs.io/v1/text-to-speech/v1');
    assert.equal(capturedInit.headers['xi-api-key'], 'k');
    assert.equal(capturedInit.headers.Accept, 'audio/mpeg');
    const body = JSON.parse(capturedInit.body);
    assert.equal(body.text, 'こんにちは');
    assert.equal(body.model_id, 'eleven_multilingual_v2');
  } finally {
    restore();
  }
});

test('synthesizeSpeech: APIエラーは例外を投げる', async () => {
  const restore = mockFetchOnce(async () => ({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    json: async () => { throw new Error('not json'); },
  }));
  try {
    await assert.rejects(() => synthesizeSpeech({ apiKey: 'k', voiceId: 'v', text: 't' }), /429/);
  } finally {
    restore();
  }
});

test('deleteVoice: apiKeyかvoiceIdが無ければ何もしない', async () => {
  let called = false;
  const restore = mockFetchOnce(async () => { called = true; return { ok: true }; });
  try {
    await deleteVoice({ apiKey: '', voiceId: 'v' });
    await deleteVoice({ apiKey: 'k', voiceId: '' });
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test('deleteVoice: 成功時はDELETEで正しいURLを呼ぶ', async () => {
  let capturedUrl, capturedInit;
  const restore = mockFetchOnce(async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return { ok: true };
  });
  try {
    await deleteVoice({ apiKey: 'k', voiceId: 'v9' });
    assert.equal(capturedUrl, 'https://api.elevenlabs.io/v1/voices/v9');
    assert.equal(capturedInit.method, 'DELETE');
    assert.equal(capturedInit.headers['xi-api-key'], 'k');
  } finally {
    restore();
  }
});

test('deleteVoice: APIエラーは例外を投げる', async () => {
  const restore = mockFetchOnce(async () => ({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    json: async () => ({ detail: 'voice not found' }),
  }));
  try {
    await assert.rejects(() => deleteVoice({ apiKey: 'k', voiceId: 'v' }), /voice not found/);
  } finally {
    restore();
  }
});
