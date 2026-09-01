import test from 'node:test';
import assert from 'node:assert/strict';
import { todayReviewDoneOf, reviewDailyGoal } from '../src/lib/reviewGoal.js';

test('todayReviewDoneOf: 今日のsource:review件数だけを数える', () => {
  const now = new Date(2026, 8, 10, 12).getTime();
  const history = [
    { source: 'review', at: new Date(2026, 8, 10, 8).getTime() },
    { source: 'review', at: new Date(2026, 8, 9, 8).getTime() }, // 昨日
    { at: new Date(2026, 8, 10, 9).getTime() }, // sourceなし＝通常学習
  ];
  assert.equal(todayReviewDoneOf(history, now), 1);
});

test('reviewDailyGoal: 通常時は今日の消化＋残り期限数', () => {
  const g = reviewDailyGoal([], 10, null);
  assert.equal(g.todayReviewDone, 0);
  assert.equal(g.dailyGoal, 10);
  assert.equal(g.goalPct, 0);
});

test('reviewDailyGoal: しんどい日はノルマを半分に緩める', () => {
  const g = reviewDailyGoal([], 10, 'tired');
  assert.equal(g.dailyGoal, 5);
});

test('reviewDailyGoal: 0問でも最低1のノルマを持つ（0除算回避）', () => {
  const g = reviewDailyGoal([], 0, null);
  assert.equal(g.dailyGoal, 1);
  assert.equal(g.goalPct, 0);
});
