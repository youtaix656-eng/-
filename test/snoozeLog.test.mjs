import test from 'node:test';
import assert from 'node:assert/strict';
import { snoozeCount, isSnoozeHabit, SNOOZE_HABIT_THRESHOLD } from '../src/lib/snoozeLog.js';

test('snoozeCount: 記録が無ければ0', () => {
  assert.equal(snoozeCount({}, 'q1'), 0);
});

test('snoozeCount: 問題ごとの件数を数える', () => {
  const log = { q1: [1, 2, 3] };
  assert.equal(snoozeCount(log, 'q1'), 3);
});

test('isSnoozeHabit: 閾値未満はfalse、以上はtrue', () => {
  const log = { q1: Array(SNOOZE_HABIT_THRESHOLD - 1).fill(0) };
  assert.equal(isSnoozeHabit(log, 'q1'), false);
  log.q1.push(0);
  assert.equal(isSnoozeHabit(log, 'q1'), true);
});
