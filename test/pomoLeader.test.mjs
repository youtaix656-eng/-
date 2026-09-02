import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruneStalePeers, computeLeaderId, isLeader, makeTabId, STALE_MS } from '../src/lib/pomoLeader.js';

test('makeTabId: 呼ぶたびに違うIDを返す', () => {
  const a = makeTabId();
  const b = makeTabId();
  assert.notEqual(a, b);
  assert.equal(typeof a, 'string');
});

test('pruneStalePeers: 古いhelloは取り除かれる', () => {
  const now = 100000;
  const peers = new Map([
    ['a', { at: now - 1000, visible: false }],
    ['b', { at: now - 20000, visible: false }], // STALE_MSより前
  ]);
  const pruned = pruneStalePeers(peers, now);
  assert.ok(pruned.has('a'));
  assert.ok(!pruned.has('b'));
});

test('computeLeaderId: 単独タブなら自分が幹事', () => {
  const peers = new Map([['solo', { at: 0, visible: false }]]);
  assert.equal(computeLeaderId(peers), 'solo');
});

test('computeLeaderId: 見えているタブがいれば、見えているタブの中の最小IDが幹事', () => {
  const peers = new Map([
    ['z-hidden', { at: 0, visible: false }],
    ['b-visible', { at: 0, visible: true }],
    ['a-visible', { at: 0, visible: true }],
  ]);
  assert.equal(computeLeaderId(peers), 'a-visible');
});

test('computeLeaderId: 誰も見えていなければ全タブの中の最小ID', () => {
  const peers = new Map([
    ['z', { at: 0, visible: false }],
    ['a', { at: 0, visible: false }],
  ]);
  assert.equal(computeLeaderId(peers), 'a');
});

test('computeLeaderId: 空なら null', () => {
  assert.equal(computeLeaderId(new Map()), null);
});

test('isLeader: 古いpeerは無視して判定する', () => {
  const now = 100000;
  const peers = new Map([
    ['old-min', { at: now - STALE_MS - 1, visible: false }], // 期限切れなので除外される
    ['me', { at: now, visible: false }],
  ]);
  assert.equal(isLeader(peers, 'me', now), true);
  assert.equal(isLeader(peers, 'old-min', now), false); // 期限切れの側から見ても自分はもう幹事ではない
});

test('isLeader: 見えているタブが他にいれば、隠れている自分は幹事ではない', () => {
  const now = 0;
  const peers = new Map([
    ['me', { at: 0, visible: false }],
    ['other', { at: 0, visible: true }],
  ]);
  assert.equal(isLeader(peers, 'me', now), false);
});
