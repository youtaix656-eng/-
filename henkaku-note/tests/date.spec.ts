import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toKey, fromKey, addDays, diffDays, startOfWeek, endOfWeek, weekDays, monthGrid,
  toMinutes, toHHMM, formatClock, formatDateJa, formatWeekRangeJa,
} from '../src/lib/date.js';

test('日付キーの往復', () => {
  assert.equal(toKey(new Date(2026, 8, 1)), '2026-09-01');
  assert.equal(toKey(fromKey('2026-09-01')!), '2026-09-01');
  assert.equal(fromKey('2026-02-31'), null); // 存在しない日は弾く
  assert.equal(fromKey('こわれた'), null);
  assert.equal(fromKey(''), null);
});

test('日付の加算は月・年をまたいでも合う', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(diffDays('2026-08-01', '2026-08-31'), 30);
  assert.equal(diffDays('2026-08-31', '2026-08-01'), -30);
});

test('週は月曜始まり', () => {
  // 2026-08-21 は金曜
  assert.equal(startOfWeek('2026-08-21'), '2026-08-17');
  assert.equal(endOfWeek('2026-08-21'), '2026-08-23');
  // 日曜は「その週の終わり」であって次の週の頭ではない
  assert.equal(startOfWeek('2026-08-23'), '2026-08-17');
  assert.equal(startOfWeek('2026-08-24'), '2026-08-24');
  assert.equal(weekDays('2026-08-21').length, 7);
  assert.equal(weekDays('2026-08-21')[0], '2026-08-17');
});

test('月グリッドは常に42マスで、月曜から始まる', () => {
  for (const [y, m] of [[2026, 0], [2026, 1], [2026, 7], [2027, 11]] as [number, number][]) {
    const grid = monthGrid(y, m);
    assert.equal(grid.length, 42);
    assert.equal(startOfWeek(grid[0].key), grid[0].key);
    const inMonth = grid.filter((c) => c.inMonth);
    assert.equal(inMonth.length, new Date(y, m + 1, 0).getDate());
  }
});

test('時刻の変換と、24時をまたぐ表示', () => {
  assert.equal(toMinutes('00:00'), 0);
  assert.equal(toMinutes('23:59'), 1439);
  assert.equal(toMinutes('9:05'), 545);
  assert.equal(toMinutes('24:00'), null);
  assert.equal(toMinutes('12:60'), null);
  assert.equal(toMinutes('こわれた'), null);
  assert.equal(toHHMM(90), '01:30');
  assert.equal(toHHMM(1530), '01:30'); // 24時間を折り返す
  assert.equal(formatClock(1530), '翌01:30');
  assert.equal(formatClock(1380), '23:00');
});

test('日本語の表示', () => {
  assert.equal(formatDateJa('2026-08-21'), '8月21日（金）');
  assert.equal(formatWeekRangeJa('2026-08-17'), '8月17日 〜 8月23日');
});
