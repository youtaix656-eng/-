import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDaysKey, formatDate, formatDateTime, fromKey, isDateKey, keyOf, toKey } from '../src/lib/date.js';

test('日付キーはローカル日付で組み立てる（UTCに直さない）', () => {
  const d = new Date(2026, 0, 1, 0, 30); // 1月1日 0:30
  assert.equal(toKey(d), '2026-01-01');
  assert.equal(keyOf(d.getTime()), '2026-01-01');
});

test('fromKey は同じ日の午前0時（ローカル）になる', () => {
  const d = fromKey('2026-09-12');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8);
  assert.equal(d.getDate(), 12);
  assert.equal(d.getHours(), 0);
});

test('日数を足す（月またぎ）', () => {
  assert.equal(addDaysKey('2026-09-30', 1), '2026-10-01');
  assert.equal(addDaysKey('2026-03-01', -1), '2026-02-28');
});

test('isDateKey と表示形式', () => {
  assert.equal(isDateKey('2026-09-12'), true);
  assert.equal(isDateKey('2026/09/12'), false);
  assert.equal(isDateKey(null), false);
  assert.equal(formatDate('2026-09-12'), '2026/09/12');
  assert.equal(formatDateTime(new Date(2026, 8, 12, 7, 5).getTime()), '2026/09/12 07:05');
});
