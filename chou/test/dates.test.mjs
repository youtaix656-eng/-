import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toKey,
  todayKey,
  parseKey,
  toDate,
  shiftKey,
  rangeKeys,
  lastKeys,
  diffDays,
  formatKey,
  formatShort,
  monthStart,
  shiftMonth,
  daysInMonth,
  timeOrder,
} from '../src/lib/dates.js';

test('日付は端末のローカル日付になる（UTCへずらさない）', () => {
  // 日本時間の午前0時ちょうど。toISOString() で組み立てると前日になる時刻。
  const midnight = new Date(2026, 8, 2, 0, 0, 0);
  assert.equal(toKey(midnight), '2026-09-02');
  assert.equal(todayKey(midnight), '2026-09-02');
  // 23:59 でも同じ日
  assert.equal(toKey(new Date(2026, 8, 2, 23, 59, 59)), '2026-09-02');
});

test('parseKey は形の違うものを受け取らない', () => {
  assert.deepEqual(parseKey('2026-09-02'), { y: 2026, m: 9, d: 2 });
  for (const bad of ['2026-9-2', '20260902', '', null, undefined, {}, '2026-13-01', '2026-01-00']) {
    assert.equal(parseKey(bad), null, String(bad));
  }
});

test('toDate は正午に置く（夏時間や丸めで前後の日へずれないため）', () => {
  const d = toDate('2026-09-02');
  assert.equal(d.getHours(), 12);
  assert.equal(toKey(d), '2026-09-02');
});

test('日をまたぐ・月をまたぐ・年をまたぐ', () => {
  assert.equal(shiftKey('2026-09-02', 1), '2026-09-03');
  assert.equal(shiftKey('2026-08-31', 1), '2026-09-01');
  assert.equal(shiftKey('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftKey('2028-02-28', 1), '2028-02-29'); // うるう年
});

test('rangeKeys / lastKeys は古い順で、両端を含む', () => {
  assert.deepEqual(rangeKeys('2026-09-01', '2026-09-03'), ['2026-09-01', '2026-09-02', '2026-09-03']);
  const keys = lastKeys(3, '2026-03-01');
  assert.deepEqual(keys, ['2026-02-27', '2026-02-28', '2026-03-01']);
  assert.equal(lastKeys(14, '2026-09-02').length, 14);
});

test('壊れた入力で rangeKeys が止まらなくなることはない', () => {
  assert.deepEqual(rangeKeys('こわれた', '2026-09-02'), []);
  assert.deepEqual(rangeKeys('2026-09-02', 'こわれた'), []);
});

test('diffDays', () => {
  assert.equal(diffDays('2026-08-20', '2026-09-02'), 13);
  assert.equal(diffDays('2026-09-02', '2026-09-02'), 0);
});

test('月の計算（1月31日の次の月は2月1日にそろえる）', () => {
  assert.equal(monthStart('2026-09-02'), '2026-09-01');
  assert.equal(shiftMonth('2026-01-31', 1), '2026-02-01');
  assert.equal(shiftMonth('2026-01-15', -1), '2025-12-01');
  assert.equal(daysInMonth('2026-02-01'), 28);
  assert.equal(daysInMonth('2028-02-01'), 29);
});

test('画面に出す形', () => {
  assert.equal(formatKey('2026-09-02'), '2026年9月2日（水）');
  assert.equal(formatKey('2026-09-02', { withYear: false }), '9月2日（水）');
  assert.equal(formatShort('2026-09-02'), '9/2');
  assert.equal(formatKey('こわれた'), '');
});

test('時刻の並べ替えは、不正な値を末尾へ送る', () => {
  assert.ok(timeOrder('07:20') < timeOrder('12:30'));
  assert.ok(timeOrder('') > timeOrder('23:59'));
});
