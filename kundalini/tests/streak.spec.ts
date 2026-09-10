import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentDays, dayOrdinal, longestDays, totalDays, spans, dayStatus, hasStarted } from '../src/lib/streak.js';
import { DAY, relapse, testState } from './fixtures.js';

const NOW = new Date(2026, 8, 10, 12, 0, 0).getTime();

test('開始当日は0日・1日目', () => {
  const started = NOW - 3 * 3600000;
  assert.equal(currentDays(started, NOW), 0);
  assert.equal(dayOrdinal(started, NOW), 1);
});

test('丸1日たつと1日になる', () => {
  assert.equal(currentDays(NOW - DAY - 1000, NOW), 1);
  assert.equal(currentDays(NOW - 7 * DAY, NOW), 7);
});

test('未開始・先の日付でもマイナスにならない', () => {
  assert.equal(currentDays(null, NOW), 0);
  assert.equal(currentDays(NOW + DAY, NOW), 0);
});

test('最長記録は過去といまの大きいほう（保存せず毎回導く）', () => {
  const state = testState({
    startedAt: NOW - 3 * DAY,
    relapses: [relapse(NOW - 30 * DAY, NOW - 20 * DAY), relapse(NOW - 20 * DAY, NOW - 3 * DAY)],
  });
  assert.equal(longestDays(state, NOW), 17);
});

test('通算日数はリラプスしても減らない', () => {
  const state = testState({
    startedAt: NOW - 3 * DAY,
    relapses: [relapse(NOW - 30 * DAY, NOW - 20 * DAY)],
  });
  // 10日 + 3日
  assert.equal(totalDays(state, NOW), 13);
});

test('区間は古い順に並び、いま続いているぶんは endedAt が null', () => {
  const state = testState({
    startedAt: NOW - 2 * DAY,
    relapses: [relapse(NOW - 10 * DAY, NOW - 5 * DAY), relapse(NOW - 5 * DAY, NOW - 2 * DAY)],
  });
  const list = spans(state, NOW);
  assert.equal(list.length, 3);
  assert.equal(list[0].endedAt, NOW - 5 * DAY);
  assert.equal(list[2].endedAt, null);
});

test('カレンダーの状態：リラプス日が継続より優先される', () => {
  const state = testState({ startedAt: NOW - 2 * DAY, relapses: [relapse(NOW - 9 * DAY, NOW - 2 * DAY)] });
  const key = (at: number) => {
    const d = new Date(at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  assert.equal(dayStatus(state, key(NOW - 2 * DAY), NOW), 'relapse');
  assert.equal(dayStatus(state, key(NOW - 5 * DAY), NOW), 'streak');
  assert.equal(dayStatus(state, key(NOW - 30 * DAY), NOW), 'none');
});

test('まだ何も無いときは「始めていない」', () => {
  assert.equal(hasStarted(testState()), false);
  assert.equal(hasStarted(testState({ startedAt: NOW })), true);
  assert.equal(hasStarted(testState({ relapses: [relapse(NOW - DAY, NOW)] })), true);
});
