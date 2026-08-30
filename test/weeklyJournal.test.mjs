import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStartOf, buildWeeklyReport } from '../src/lib/weeklyJournal.js';

test('weekStartOf: 月曜0時に揃う', () => {
  const sun = new Date('2026-08-23T15:00:00'); // 日曜（2026-08-17週の最終日）
  const mon = new Date(weekStartOf(sun));
  assert.equal(mon.getDay(), 1);
  assert.equal(mon.getHours(), 0);
  // 同じ週の別の曜日（水曜）でも同じ週の始まりになる
  const wed = new Date('2026-08-19T09:00:00');
  assert.equal(weekStartOf(wed), weekStartOf(sun));
  // 翌週の月曜は7日後になる
  const nextMon = new Date('2026-08-24T09:00:00');
  assert.equal(weekStartOf(nextMon), weekStartOf(sun) + 7 * 24 * 60 * 60 * 1000);
});

test('buildWeeklyReport: 直近7日間だけを集計し、範囲外は無視する', () => {
  const now = new Date('2026-08-23T12:00:00').getTime();
  const DAY = 24 * 60 * 60 * 1000;
  const history = [
    { questionId: 'a', correct: true, at: now - 1 * DAY, subject: 'X' },
    { questionId: 'b', correct: false, at: now - 2 * DAY, subject: 'X' },
    { questionId: 'c', correct: false, at: now - 10 * DAY, subject: 'X' }, // 範囲外
  ];
  const out = buildWeeklyReport(history, {}, [], {}, now);
  assert.equal(out.total, 2);
  assert.equal(out.correct, 1);
  assert.equal(out.wrongCount, 1);
});

test('buildWeeklyReport: 誤答理由の型の内訳と最頻値', () => {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const history = [
    { questionId: 'a', correct: false, at: now - DAY },
    { questionId: 'b', correct: false, at: now - DAY },
    { questionId: 'c', correct: false, at: now - DAY },
  ];
  const missTypes = {
    a: { type: 'careless' },
    b: { type: 'careless' },
    c: { type: 'chishiki' },
  };
  const out = buildWeeklyReport(history, missTypes, [], {}, now);
  assert.equal(out.topType, 'careless');
  assert.equal(out.typeCounts.careless, 2);
  assert.equal(out.typeCounts.chishiki, 1);
});

test('buildWeeklyReport: 解答が無ければaccuracyはnull', () => {
  const out = buildWeeklyReport([], {}, [], {}, Date.now());
  assert.equal(out.total, 0);
  assert.equal(out.accuracy, null);
  assert.equal(out.topType, null);
});
