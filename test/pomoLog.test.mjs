import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalStudySecSince, countSince, todayStart, weekStart, dailyBreakdown, exportPomoLogCsv } from '../src/lib/pomoLog.js';

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

test('dailyBreakdown: 直近days日分を古い→新しい順に集計する', () => {
  const now = new Date(2026, 7, 31, 12, 0, 0).getTime(); // 2026-08-31 12:00
  const yesterday = new Date(2026, 7, 30, 9, 0, 0).getTime();
  const today = new Date(2026, 7, 31, 8, 0, 0).getTime();
  const log = [
    { studySec: 1500, at: yesterday },
    { studySec: 600, at: today },
  ];
  const rows = dailyBreakdown(log, 3, now);
  assert.equal(rows.length, 3);
  assert.equal(rows[rows.length - 1].sec, 600); // 今日が末尾
  assert.equal(rows[rows.length - 2].sec, 1500); // 昨日がその前
  assert.equal(rows[0].sec, 0); // 一昨日は記録なし
});

test('dailyBreakdown: 記録が無い日は0件・0秒（黙って抜け落ちない）', () => {
  const rows = dailyBreakdown([], 7, Date.now());
  assert.equal(rows.length, 7);
  assert.ok(rows.every((r) => r.sec === 0 && r.count === 0));
});

test('exportPomoLogCsv: ヘッダーと各行を出力する', () => {
  const log = [{ studySec: 1500, at: new Date(2026, 7, 31, 10, 0).getTime(), label: '解剖学' }];
  const csv = exportPomoLogCsv(log);
  const lines = csv.split('\n');
  assert.equal(lines[0], '日時,勉強時間（分）,内容メモ');
  assert.ok(lines[1].includes('25')); // 1500秒=25分
  assert.ok(lines[1].includes('解剖学'));
});

test('exportPomoLogCsv: カンマを含むメモはダブルクォートで囲む', () => {
  const log = [{ studySec: 60, at: 0, label: '解剖,生理' }];
  const csv = exportPomoLogCsv(log);
  assert.ok(csv.includes('"解剖,生理"'));
});
