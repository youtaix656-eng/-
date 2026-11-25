import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftReminderKey, shiftReminderDue } from '../src/data/haripan.js';

const at = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm, 0, 0);

test('勤務明けの90分の間だけ当たり、その回の日時を返す', () => {
  const sr = { enabled: true, afterTime: '08:00' };
  assert.equal(shiftReminderKey(sr, at(2026, 11, 25, 8, 30)), '2026-11-25 08:00');
  assert.equal(shiftReminderKey(sr, at(2026, 11, 25, 9, 31)), null);
  assert.equal(shiftReminderKey(sr, at(2026, 11, 25, 7, 59)), null);
});

test('時刻を一度も触っていなくても画面の既定（08:00）で当たる', () => {
  assert.equal(shiftReminderDue({ enabled: true }, at(2026, 11, 25, 8, 10)), true);
  assert.equal(shiftReminderDue({ enabled: false, afterTime: '08:00' }, at(2026, 11, 25, 8, 10)), false);
});

test('日付をまたぐ回は、0時を過ぎても前日の回として当たる', () => {
  const sr = { enabled: true, afterTime: '23:30' };
  assert.equal(shiftReminderKey(sr, at(2026, 11, 26, 0, 40)), '2026-11-25 23:30');
  assert.equal(shiftReminderKey(sr, at(2026, 11, 26, 1, 5)), null);
});
