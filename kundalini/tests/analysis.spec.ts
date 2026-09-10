import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayPoints,
  distributionByDayBand,
  relapsesByBand,
  relapsesByWeekday,
  relapsesByTrigger,
  filledDays,
  MIN_FOR_TREND,
} from '../src/lib/analysis.js';
import { DAY, relapse, testState } from './fixtures.js';
import { toKey } from '../src/lib/date.js';
import type { DayRecord } from '../src/types/index.js';

const NOW = new Date(2026, 8, 10, 12, 0, 0).getTime();

function day(at: number, over: Partial<DayRecord> = {}): [string, DayRecord] {
  const date = toKey(new Date(at));
  return [date, { date, body: null, focus: null, mood: null, journal: '', updatedAt: at, ...over }];
}

test('曜日別・時間帯別はただ数えるだけ', () => {
  const state = testState({
    relapses: [
      relapse(NOW - 5 * DAY, new Date(2026, 8, 7, 23, 0).getTime()),
      relapse(NOW - 3 * DAY, new Date(2026, 8, 8, 2, 0).getTime()),
    ],
  });
  const wd = relapsesByWeekday(state);
  assert.equal(wd.length, 7);
  assert.equal(wd.reduce((n, r) => n + r.count, 0), 2);
  const band = relapsesByBand(state);
  assert.equal(band.find((b) => b.id === 'evening')?.count, 1);
  assert.equal(band.find((b) => b.id === 'night')?.count, 1);
});

test('きっかけは多い順に並ぶ', () => {
  const state = testState({
    relapses: [
      relapse(NOW - 9 * DAY, NOW - 8 * DAY, ['sns']),
      relapse(NOW - 8 * DAY, NOW - 7 * DAY, ['sns', 'bed']),
    ],
  });
  const rows = relapsesByTrigger(state);
  assert.equal(rows[0].id, 'sns');
  assert.equal(rows[0].count, 2);
});

test('記録した日に「その日の継続日数」を付けて並べる（継続外は null）', () => {
  const state = testState({
    startedAt: NOW - 5 * DAY,
    days: Object.fromEntries([day(NOW - 3 * DAY, { mood: 4 }), day(NOW - 30 * DAY, { mood: 2 })]),
  });
  const points = dayPoints(state, NOW);
  const inStreak = points.find((p) => p.mood === 4);
  const outside = points.find((p) => p.mood === 2);
  assert.equal(inStreak?.days, 2);
  assert.equal(outside?.days, null);
});

test('分布は件数だけを返す（平均を返す関数を持たない）', () => {
  const state = testState({
    startedAt: NOW - 20 * DAY,
    days: Object.fromEntries([day(NOW - 19 * DAY, { mood: 1 }), day(NOW - 2 * DAY, { mood: 5 })]),
  });
  const rows = distributionByDayBand(dayPoints(state, NOW), 'mood');
  const first = rows.find((r) => r.label === '0〜6日');
  const third = rows.find((r) => r.label === '14〜29日');
  assert.equal(first?.counts[0], 1);
  assert.equal(third?.counts[4], 1);
  assert.equal(first?.total, 1);
});

test('記録の埋まり具合は「書いた日数」だけを返す（連続で数えない）', () => {
  const state = testState({ days: Object.fromEntries([day(NOW, { journal: 'a' }), day(NOW - 5 * DAY, { body: 3 })]) });
  const fill = filledDays(state, NOW, 14);
  assert.equal(fill.filled, 2);
  assert.equal(fill.total, 14);
});

test('傾向とみなす下限を持っている（1件で断定しない）', () => {
  assert.ok(MIN_FOR_TREND >= 3);
});
