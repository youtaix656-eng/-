import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datesWithEntries, entriesOn, occursOn, sortExams, thisWeek, validateEntry } from '../src/lib/schedule.js';
import type { ScheduleEntry } from '../src/types/index.js';

function entry(over: Partial<ScheduleEntry>): ScheduleEntry {
  return { id: 'e', type: 'work', date: '2026-09-14', startTime: '08:00', endTime: '17:00', repeat: 'none', memo: '', ...over };
}

test('繰り返し：なし・毎日・毎週・平日', () => {
  assert.equal(occursOn(entry({}), '2026-09-14'), true);
  assert.equal(occursOn(entry({}), '2026-09-15'), false);
  assert.equal(occursOn(entry({ repeat: 'daily' }), '2026-10-01'), true);
  assert.equal(occursOn(entry({ repeat: 'daily' }), '2026-09-13'), false); // 始まる前
  assert.equal(occursOn(entry({ repeat: 'weekly' }), '2026-09-21'), true); // 翌週の月曜
  assert.equal(occursOn(entry({ repeat: 'weekly' }), '2026-09-22'), false);
  assert.equal(occursOn(entry({ repeat: 'weekdays' }), '2026-09-18'), true); // 金
  assert.equal(occursOn(entry({ repeat: 'weekdays' }), '2026-09-19'), false); // 土
});

test('その日の予定は開始時刻順', () => {
  const list = entriesOn([entry({ id: 'b', startTime: '13:00' }), entry({ id: 'a', startTime: '09:00' })], '2026-09-14');
  assert.deepEqual(list.map((e) => e.id), ['a', 'b']);
});

test('カレンダーの印は繰り返しを展開して出す', () => {
  const set = datesWithEntries([entry({ repeat: 'weekly' })], 2026, 9);
  assert.deepEqual([...set].sort(), ['2026-09-14', '2026-09-21', '2026-09-28']);
});

test('今週の一覧は日付つき', () => {
  const week = thisWeek([entry({ repeat: 'weekdays' })], '2026-09-16');
  assert.equal(week.length, 5);
  assert.equal(week[0].date, '2026-09-14');
});

test('保存前の確認：終了が開始より前なら止める', () => {
  assert.deepEqual(validateEntry({ date: '2026-09-14', startTime: '09:00', endTime: '17:00' }), []);
  assert.equal(validateEntry({ date: '2026-09-14', startTime: '17:00', endTime: '09:00' })[0].field, 'endTime');
  assert.equal(validateEntry({ date: '2026-02-30', startTime: '09:00', endTime: '17:00' })[0].field, 'date');
  assert.equal(validateEntry({ date: '2026-09-14', startTime: '', endTime: '17:00' })[0].field, 'startTime');
});

test('試験日は近い順・過ぎたものは後ろ', () => {
  const exams = sortExams(
    [
      { id: 'a', name: 'A', date: '2027-02-28' },
      { id: 'b', name: 'B', date: '2026-08-01' },
      { id: 'c', name: 'C', date: '2026-11-15' },
    ],
    '2026-09-12',
  );
  assert.deepEqual(exams.map((e) => e.id), ['c', 'a', 'b']);
});
