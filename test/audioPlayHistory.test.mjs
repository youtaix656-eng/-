import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  upsertHistory, removeFromHistory, normalizeEntry, historyTitle, positionText, AUDIO_HISTORY_MAX,
} from '../src/lib/audioPlayHistory.js';

test('同じ科目は1件にまとめ、どこまで聞いたかを上書きして先頭へ寄せる', () => {
  let list = upsertHistory([], { subject: '解剖学', index: 3, total: 123, at: 1 });
  list = upsertHistory(list, { subject: '病理学概論', index: 39, total: 173, at: 2 });
  list = upsertHistory(list, { subject: '解剖学', index: 52, total: 123, at: 3 });
  assert.equal(list.length, 2);
  assert.equal(list[0].subject, '解剖学');
  assert.equal(list[0].index, 52);
  assert.equal(positionText(list[1]), '40 / 173');
});

test('件数の上限・壊れた記録は入れない・問題数を超える位置は丸める', () => {
  let list = [];
  for (let i = 0; i < AUDIO_HISTORY_MAX + 5; i++) list = upsertHistory(list, { keyword: `k${i}`, index: 0, total: 5, at: i });
  assert.equal(list.length, AUDIO_HISTORY_MAX);
  assert.equal(normalizeEntry({ subject: 'x', index: 0, total: 0 }), null);
  assert.equal(normalizeEntry({ subject: 'x' }), null);
  assert.equal(normalizeEntry({ subject: 'x', index: 99, total: 10 }).index, 9);
  assert.deepEqual(upsertHistory(list, null).length, AUDIO_HISTORY_MAX);
});

test('見出しと削除', () => {
  assert.equal(historyTitle({}), 'すべての問題');
  assert.equal(historyTitle({ subject: '解剖学', round: '第34回' }), '解剖学・34回');
  const list = upsertHistory([], { subject: '解剖学', index: 0, total: 3 });
  assert.equal(removeFromHistory(list, list[0].key).length, 0);
});
