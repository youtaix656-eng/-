import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand } from '../src/lib/voiceCommand.js';

test('parseVoiceCommand: 自己採点の言葉を判定する', () => {
  assert.deepEqual(parseVoiceCommand('まる'), { type: 'grade', kind: 'maru' });
  assert.deepEqual(parseVoiceCommand('できた'), { type: 'grade', kind: 'maru' });
  assert.deepEqual(parseVoiceCommand('ばつ'), { type: 'grade', kind: 'batsu' });
  assert.deepEqual(parseVoiceCommand('わからない'), { type: 'grade', kind: 'batsu' });
  assert.deepEqual(parseVoiceCommand('あいまい'), { type: 'grade', kind: 'sankaku' });
});

test('parseVoiceCommand: 操作の言葉を判定する', () => {
  assert.deepEqual(parseVoiceCommand('次'), { type: 'nav', kind: 'next' });
  assert.deepEqual(parseVoiceCommand('前へ'), { type: 'nav', kind: 'prev' });
  assert.deepEqual(parseVoiceCommand('ストップ'), { type: 'nav', kind: 'stop' });
});

test('parseVoiceCommand: どれにも当たらない・空文字はnull', () => {
  assert.equal(parseVoiceCommand('こんにちは'), null);
  assert.equal(parseVoiceCommand(''), null);
  assert.equal(parseVoiceCommand(null), null);
});
