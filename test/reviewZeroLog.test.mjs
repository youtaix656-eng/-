import test from 'node:test';
import assert from 'node:assert/strict';
import {
  zeroDaysSummary, daysSinceLastZero, zeroRateByWeekday, finishDaysSummary, reviewZeroLogToCsv,
} from '../src/lib/reviewZeroLog.js';

function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('zeroDaysSummary: 直近days日のうち記録がある日数を数える', () => {
  const now = new Date(2026, 8, 10).getTime(); // 2026-09-10
  const log = {
    [keyOf(new Date(2026, 8, 10))]: now,
    [keyOf(new Date(2026, 8, 9))]: now - 86400000,
    [keyOf(new Date(2026, 8, 1))]: now - 9 * 86400000, // 範囲外（7日の外）
  };
  const s = zeroDaysSummary(log, 7, now);
  assert.equal(s.total, 7);
  assert.equal(s.achieved, 2);
});

test('daysSinceLastZero: 最後の達成日からの経過日数', () => {
  const now = new Date(2026, 8, 10).getTime();
  const log = { [keyOf(new Date(2026, 8, 7))]: now };
  assert.equal(daysSinceLastZero(log, now), 3);
});

test('daysSinceLastZero: 記録が無ければnull', () => {
  assert.equal(daysSinceLastZero({}, Date.now()), null);
});

test('daysSinceLastZero: 今日達成済みなら0', () => {
  const now = new Date(2026, 8, 10).getTime();
  const log = { [keyOf(new Date(2026, 8, 10))]: now };
  assert.equal(daysSinceLastZero(log, now), 0);
});

test('zeroRateByWeekday: 曜日別の達成率と母数を返す', () => {
  const now = new Date(2026, 8, 10).getTime(); // 木曜
  const log = {};
  for (let i = 0; i < 14; i += 7) log[keyOf(new Date(now - i * 86400000))] = now; // 2週分の同じ曜日
  const rates = zeroRateByWeekday(log, 14, now);
  assert.equal(rates.length, 7);
  const thu = rates.find((r) => r.weekday === new Date(now).getDay());
  assert.equal(thu.achieved, 2);
  assert.equal(thu.total, 2);
  assert.equal(thu.rate, 1);
});

test('reviewZeroLogToCsv: 日付順のCSVを生成する（#29）', () => {
  const csv = reviewZeroLogToCsv({ '2026-09-02': 1, '2026-09-01': 1 });
  const lines = csv.split('\n');
  assert.equal(lines[0], '日付,復習ゼロを達成');
  assert.equal(lines[1], '2026-09-01,達成');
  assert.equal(lines[2], '2026-09-02,達成');
});

test('reviewZeroLogToCsv: 空ログでもヘッダーだけ返す', () => {
  assert.equal(reviewZeroLogToCsv({}), '日付,復習ゼロを達成');
});

test('finishDaysSummary: ゼロログ or maru-review履歴のどちらかがあれば実施日とする', () => {
  const now = new Date(2026, 8, 10).getTime();
  const log = { [keyOf(new Date(2026, 8, 10))]: now };
  const history = [{ questionId: 'a', source: 'maru-review', at: new Date(2026, 8, 9).getTime() }];
  const s = finishDaysSummary(log, history, 5, now);
  assert.equal(s.total, 5);
  assert.equal(s.achieved, 2); // 9/10（ログ）と9/9（maru-review）
});
