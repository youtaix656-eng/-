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

test('parseVoiceCommand: 「全部できた」は"できた"(○)より先にallDoneとして判定される（新規#9）', () => {
  assert.deepEqual(parseVoiceCommand('全部できた'), { type: 'nav', kind: 'allDone' });
  assert.deepEqual(parseVoiceCommand('残り全部'), { type: 'nav', kind: 'allDone' });
  // 単に「できた」だけなら通常どおり○
  assert.deepEqual(parseVoiceCommand('できた'), { type: 'grade', kind: 'maru' });
});

test('parseVoiceCommand: 本人登録のcustomWordsは組み込みより先に判定される（新規#7）', () => {
  const custom = [{ word: '分かった', type: 'grade', kind: 'maru' }];
  assert.deepEqual(parseVoiceCommand('分かった', custom), { type: 'grade', kind: 'maru' });
  // customWordsに無い言葉は通常どおり組み込みの判定
  assert.deepEqual(parseVoiceCommand('まる', custom), { type: 'grade', kind: 'maru' });
});
