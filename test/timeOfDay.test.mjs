import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hourlyPerformance, isNowBestTime } from '../src/lib/timeOfDay.js';

function atHour(hour, dateStr = '2026-08-24') {
  return new Date(`${dateStr}T${String(hour).padStart(2, '0')}:00:00`).getTime();
}

test('hourlyPerformance: 時間帯ごとに正答率を集計する', () => {
  const history = [
    ...Array.from({ length: 12 }, (_, i) => ({ at: atHour(8), correct: i < 10 })), // 朝：10/12
    ...Array.from({ length: 12 }, (_, i) => ({ at: atHour(14), correct: i < 3 })), // 昼：3/12
  ];
  const out = hourlyPerformance(history, { minSample: 10 });
  const morning = out.buckets.find((b) => b.id === 'morning');
  const midday = out.buckets.find((b) => b.id === 'midday');
  assert.equal(morning.total, 12);
  assert.equal(midday.total, 12);
  assert.equal(out.best.id, 'morning');
});

test('hourlyPerformance: 深夜（23時〜翌5時）は日をまたいで集計される', () => {
  const history = [
    ...Array.from({ length: 10 }, () => ({ at: atHour(23), correct: true })),
    ...Array.from({ length: 10 }, () => ({ at: atHour(2), correct: true })),
  ];
  const out = hourlyPerformance(history, { minSample: 5 });
  const night = out.buckets.find((b) => b.id === 'night');
  assert.equal(night.total, 20);
});

test('hourlyPerformance: サンプル不足の時間帯はbestの対象外', () => {
  const history = [
    { at: atHour(8), correct: true },
    { at: atHour(8), correct: true },
  ]; // 朝：2件のみ（minSample未満）
  const out = hourlyPerformance(history, { minSample: 10 });
  assert.equal(out.best, null);
});

test('hourlyPerformance: 空履歴でも落ちない', () => {
  const out = hourlyPerformance([]);
  assert.equal(out.best, null);
  assert.equal(out.buckets.length, 4);
});

test('isNowBestTime: 今が最も正答率の高い時間帯ならその帯を返す', () => {
  const history = [
    ...Array.from({ length: 12 }, (_, i) => ({ at: atHour(8), correct: i < 10 })), // 朝：10/12
    ...Array.from({ length: 12 }, (_, i) => ({ at: atHour(14), correct: i < 3 })), // 昼：3/12
  ];
  const now = new Date(atHour(9));
  const best = isNowBestTime(history, { minSample: 10, now });
  assert.equal(best?.id, 'morning');
});

test('isNowBestTime: 今がbestの時間帯でなければnull', () => {
  const history = [
    ...Array.from({ length: 12 }, (_, i) => ({ at: atHour(8), correct: i < 10 })),
    ...Array.from({ length: 12 }, (_, i) => ({ at: atHour(14), correct: i < 3 })),
  ];
  const now = new Date(atHour(20));
  assert.equal(isNowBestTime(history, { minSample: 10, now }), null);
});

test('isNowBestTime: bestが無ければnull', () => {
  const history = [{ at: atHour(8), correct: true }];
  const now = new Date(atHour(8));
  assert.equal(isNowBestTime(history, { minSample: 10, now }), null);
});
