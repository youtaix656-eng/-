import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedCount, daysUntil, rangeKeys, recentTags, streakDays, tagBreakdown, totalMinutes, weekBars } from '../src/lib/stats.js';
import { formatHm, formatShort, startOfWeekKey } from '../src/lib/date.js';
import { rec } from './fixtures.js';

const TODAY = '2026-09-12'; // 土曜

test('週は月曜始まり', () => {
  assert.equal(startOfWeekKey(TODAY), '2026-09-07');
  assert.deepEqual(rangeKeys('week', TODAY), { from: '2026-09-07', to: '2026-09-13' });
  assert.deepEqual(rangeKeys('month', TODAY), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(rangeKeys('today', TODAY), { from: TODAY, to: TODAY });
});

test('合計時間は飛ばした分も数え、完了数は最後までの分だけ', () => {
  const records = [rec(TODAY, 25), rec(TODAY, 7, null, false), rec('2026-09-01', 25)];
  assert.equal(totalMinutes(records, 'today', TODAY), 32);
  assert.equal(completedCount(records, 'today', TODAY), 1);
  assert.equal(totalMinutes(records, 'month', TODAY), 57);
});

test('連続達成日数：今日が無ければ昨日から数える', () => {
  assert.equal(streakDays([rec('2026-09-11', 25), rec('2026-09-10', 25)], TODAY), 2);
  assert.equal(streakDays([rec(TODAY, 25), rec('2026-09-11', 25), rec('2026-09-09', 25)], TODAY), 2);
  assert.equal(streakDays([rec(TODAY, 7, null, false)], TODAY), 0);
  assert.equal(streakDays([], TODAY), 0);
});

test('週の推移は7本・曜日と日にち・今日の印', () => {
  const bars = weekBars([rec('2026-09-08', 50)], TODAY);
  assert.equal(bars.length, 7);
  assert.equal(bars[0].weekday, '月');
  assert.equal(bars[0].label, '9/7');
  assert.equal(bars[1].minutes, 50);
  assert.equal(bars.filter((b) => b.isToday).length, 1);
  assert.equal(bars[5].isToday, true);
});

test('タグ別内訳は多い順・タグなしは別枠', () => {
  const rows = tagBreakdown([rec(TODAY, 90, '鍼灸国試勉強'), rec(TODAY, 45, 'アプリ開発'), rec(TODAY, 10)], 'today', TODAY);
  assert.deepEqual(rows.map((r) => r.tag), ['鍼灸国試勉強', 'アプリ開発', 'タグなし']);
  assert.equal(rows[0].minutes, 90);
});

test('最近のタグは新しい順で重複なし', () => {
  const tags = recentTags([rec(TODAY, 25, 'a', true, 1), rec(TODAY, 25, 'b', true, 3), rec(TODAY, 25, 'a', true, 2)]);
  assert.deepEqual(tags, ['b', 'a']);
});

test('残り日数と表記', () => {
  assert.equal(daysUntil('2027-02-28', TODAY), 169);
  assert.equal(daysUntil(TODAY, TODAY), 0);
  assert.equal(formatHm(135), '2:15');
  assert.equal(formatShort(90), '1h30m');
  assert.equal(formatShort(45), '45m');
});
