import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalStudySecSince, countSince, todayStart, weekStart } from '../src/lib/pomoLog.js';

test('totalStudySecSince: 基準時刻以降のstudySecだけ合計する', () => {
  const log = [
    { studySec: 1500, at: 100 },
    { studySec: 900, at: 200 },
    { studySec: 300, at: 50 },
  ];
  assert.equal(totalStudySecSince(log, 100), 2400);
  assert.equal(totalStudySecSince(log, 0), 2700);
});

test('countSince: 基準時刻以降の件数を数える', () => {
  const log = [{ studySec: 1, at: 100 }, { studySec: 1, at: 200 }, { studySec: 1, at: 50 }];
  assert.equal(countSince(log, 100), 2);
});

test('totalStudySecSince/countSince: 空配列でも落ちない', () => {
  assert.equal(totalStudySecSince([], 0), 0);
  assert.equal(countSince(undefined, 0), 0);
});

test('todayStart: 今日の0時0分0秒のタイムスタンプを返す', () => {
  const now = new Date(2026, 7, 31, 15, 30, 0).getTime(); // 2026-08-31 15:30
  const t = todayStart(now);
  const d = new Date(t);
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
  assert.equal(d.getDate(), 31);
});

test('weekStart: 週の始まり（日曜0時）のタイムスタンプを返す', () => {
  const now = new Date(2026, 7, 31, 15, 0, 0).getTime(); // 2026-08-31は月曜
  const t = weekStart(now);
  const d = new Date(t);
  assert.equal(d.getDay(), 0); // 日曜
  assert.ok(t <= now);
});
