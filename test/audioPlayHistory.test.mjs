import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  upsertHistory, removeFromHistory, normalizeEntry, historyTitle, positionText, AUDIO_HISTORY_MAX, resolveJumpIndex,
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

test('飛び先：並びが変わっても同じ問題へ。無ければ近い番号へ寄せて知らせる。聞き終えたものは最初から', () => {
  const ids = ['a', null, 'b', 'c', 'd'];
  assert.deepEqual(resolveJumpIndex({ qid: 'c', index: 0, total: 5 }, ids), { index: 3, moved: false });
  assert.deepEqual(resolveJumpIndex({ qid: 'zz', index: 9, total: 20 }, ids), { index: 4, moved: true });
  assert.deepEqual(resolveJumpIndex({ index: 2, total: 5 }, ids), { index: 2, moved: false });
  assert.deepEqual(resolveJumpIndex({ index: 2, total: 9 }, ids), { index: 2, moved: true });
  assert.deepEqual(resolveJumpIndex({ qid: 'c', index: 3, total: 5, done: true }, ids), { index: 0, moved: false });
  assert.deepEqual(resolveJumpIndex({ qid: 'c', index: 3, total: 5 }, []), { index: 0, moved: false });
  assert.equal(positionText({ index: 0, total: 130, done: true }), '全130問・聞き終えた');
  assert.equal(normalizeEntry({ subject: 'x', index: 1, total: 3, qid: 7, done: 1 }).qid, '7');
});

import { reviewReplayIds } from '../src/lib/audioPlayHistory.js';
import { idsSignature, newerProgress } from '../src/lib/audioProgressSync.js';

test('誤答・△✕の履歴：並び（ids）と聞いた印（heard）を持ち、未聴だけ再開する', () => {
  const e = normalizeEntry({ kind: 'review', title: '誤答・△✕ 解剖学', ids: ['a', 'b', 'c', 'd', 'a'], heard: ['a', 'c', 'zz'], qid: 'b', index: 0, total: 1 });
  assert.deepEqual(e.ids, ['a', 'b', 'c', 'd']);
  assert.deepEqual(e.heard, ['a', 'c']);
  assert.equal(e.total, 4);
  assert.equal(e.index, 1); // qid=bの場所
  assert.equal(e.key, 'review|誤答・△✕ 解剖学');
  assert.equal(historyTitle(e), '誤答・△✕ 解剖学');
  assert.equal(positionText(e), '2 / 4（聞いた2問）');
  assert.deepEqual(reviewReplayIds(e), ['b', 'd']);
  const done = normalizeEntry({ ...e, heard: ['a', 'b', 'c', 'd'] });
  assert.equal(done.done, true);
  assert.deepEqual(reviewReplayIds(done), ['a', 'b', 'c', 'd']);
  assert.equal(normalizeEntry({ kind: 'review', title: 'x', ids: [], index: 0, total: 1 }), null);
  // 通常の履歴とは別の行になる
  const list = upsertHistory(upsertHistory([], { subject: '解剖学', index: 3, total: 10 }), e);
  assert.equal(list.length, 2);
});

test('idsSignature：件数が同じでも中身・順番が違えば別の署名', () => {
  assert.notEqual(idsSignature(['a', 'b']), idsSignature(['b', 'a']));
  assert.notEqual(idsSignature(['a', 'b']), idsSignature(['a', 'c']));
  assert.equal(idsSignature(['a', 'b']), idsSignature(['a', 'b']));
});

test('newerProgress：新しい方を使う・壊れた方は無視', () => {
  assert.equal(newerProgress({ index: 1, at: 5 }, { index: 2, at: 9 }).index, 2);
  assert.equal(newerProgress({ index: 1, at: 9 }, { index: 2, at: 5 }).index, 1);
  assert.equal(newerProgress(null, { index: 2, at: 5 }).index, 2);
  assert.equal(newerProgress({ index: 'x' }, null), null);
});
