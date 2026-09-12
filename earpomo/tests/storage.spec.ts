import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeState } from '../src/lib/storage.js';
import { classifyOutputs, audioAllowed } from '../src/lib/headphones.js';
import { tipsFor, SHORT_BREAK_TIPS } from '../src/data/breakTips.js';

test('欠けた・壊れた保存データを通しても落ちない', () => {
  const s = normalizeState({ presets: [], timer: { phase: 'weird' } as never, records: [{ id: 'x' } as never], settings: { bgmId: 'missing', bgmVolume: 9 } as never }, initialState());
  assert.equal(s.presets.length, 3);
  assert.equal(s.timer.phase, 'focus');
  assert.equal(s.records.length, 0);
  assert.equal(s.settings.bgmId, null);
  assert.equal(s.settings.bgmVolume, 1);
  assert.equal(normalizeState(null, initialState()).activePresetId, 'study-25');
});

test('走っていたのに endAt が無い保存データは一時停止として読む', () => {
  const s = normalizeState({ timer: { phase: 'focus', status: 'running', endAt: null, remainingMs: 1000, durationMs: 60000 } as never }, initialState());
  assert.equal(s.timer.status, 'paused');
});

test('イヤホンの判定：名前に手がかりがある時だけ「見つかった」', () => {
  assert.equal(classifyOutputs(['Default - AirPods Pro']), 'connected');
  assert.equal(classifyOutputs(['WH-1000XM5 (Bluetooth)']), 'connected');
  assert.equal(classifyOutputs(['Speakers (Realtek)']), 'unknown');
  assert.equal(classifyOutputs(['', '']), 'unknown');
  assert.equal(classifyOutputs([]), 'unknown');
});

test('音を出してよいのは、見つかった時か本人が確認した時だけ', () => {
  assert.equal(audioAllowed('unknown', false), false);
  assert.equal(audioAllowed('unknown', true), true);
  assert.equal(audioAllowed('connected', false), true);
});

test('休憩の提案は乱数ではなく何回目かで順にずれる', () => {
  assert.deepEqual(tipsFor('short', 0).map((t) => t.id), SHORT_BREAK_TIPS.slice(0, 2).map((t) => t.id));
  assert.equal(tipsFor('short', 1)[0].id, SHORT_BREAK_TIPS[1].id);
  assert.deepEqual(tipsFor('short', 0), tipsFor('short', SHORT_BREAK_TIPS.length));
  assert.equal(tipsFor('long', 0).length, 2);
});
