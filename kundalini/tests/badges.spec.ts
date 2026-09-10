import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeStates, justReached, nextBadge } from '../src/lib/badges.js';
import { BADGES } from '../src/data/badges.js';

test('マイルストーンは 7・14・30・90・180・365', () => {
  assert.deepEqual(BADGES.map((b) => b.days), [7, 14, 30, 90, 180, 365]);
});

test('いちど届いたバッジは、いま0日でも「到達ずみ」のまま残る', () => {
  const list = badgeStates(0, 40);
  const d30 = list.find((b) => b.badge.days === 30);
  assert.ok(d30);
  assert.equal(d30.unlocked, true);
  assert.equal(d30.currentlyHeld, false);
  assert.equal(d30.daysLeft, 30);
});

test('ちょうど届いた日だけ、お祝いの1件を返す', () => {
  assert.equal(justReached(7)?.days, 7);
  assert.equal(justReached(8), null);
});

test('次のマイルストーンを返す（最後まで届いていたら null）', () => {
  assert.equal(nextBadge(0)?.days, 7);
  assert.equal(nextBadge(365), null);
});
