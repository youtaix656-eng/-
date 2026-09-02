import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/lib/pomodoro.js';
import { readFileSync } from 'node:fs';

test('残り時間の表示', () => {
  assert.equal(P.formatRemain(25 * P.MINUTE), '25:00');
  assert.equal(P.formatRemain(0), '0:00');
  assert.equal(P.formatRemain(59 * 1000), '0:59');
  assert.equal(P.formatRemain(3905 * 1000), '1:05:05');
  // 端数は切り上げ（切り捨てると 0:00 が2秒ぶん出て、止まったように見える）
  assert.equal(P.formatRemain(1500), '0:02');
  assert.equal(P.formatRemain(-5), '0:00');
});

// これが崩れると、タブを裏に回して戻った時に必ずズレる。
test('残りは「終わる時刻」から引き算する（1秒ずつ減らさない）', () => {
  const t0 = 1_000_000;
  const timer = P.startTimer('focus', { ...P.DEFAULT_POMODORO, focusMin: 25 }, t0);
  assert.equal(timer.endsAt, t0 + 25 * P.MINUTE);
  assert.equal(P.remainMs(timer, t0), 25 * P.MINUTE);
  // 10分ぶん「裏に回っていた」ことにしても、戻った瞬間に正しい残りが出る
  assert.equal(P.remainMs(timer, t0 + 10 * P.MINUTE), 15 * P.MINUTE);
  assert.equal(P.remainMs(timer, t0 + 99 * P.MINUTE), 0);
  assert.equal(P.isFinished(timer, t0 + 25 * P.MINUTE), true);
  assert.equal(P.isFinished(timer, t0 + 24 * P.MINUTE), false);
});

test('一時停止と再開で残りが増えない', () => {
  const t0 = 1_000_000;
  let timer = P.startTimer('focus', P.DEFAULT_POMODORO, t0);
  timer = P.pauseTimer(timer, t0 + 5 * P.MINUTE);
  assert.equal(timer.endsAt, null);
  assert.equal(P.remainMs(timer, t0 + 60 * P.MINUTE), 20 * P.MINUTE); // 止めている間は減らない
  timer = P.resumeTimer(timer, t0 + 60 * P.MINUTE);
  assert.equal(P.remainMs(timer, t0 + 60 * P.MINUTE), 20 * P.MINUTE);
  assert.equal(P.remainMs(timer, t0 + 65 * P.MINUTE), 15 * P.MINUTE);
});

test('二重に止めても壊れない', () => {
  const t0 = 1_000_000;
  const paused = P.pauseTimer(P.startTimer('focus', P.DEFAULT_POMODORO, t0), t0);
  assert.deepEqual(P.pauseTimer(paused, t0 + 1000), paused);
});

test('長い休憩は設定した本数ごとに来る', () => {
  const s = { ...P.DEFAULT_POMODORO, longEvery: 4 };
  assert.equal(P.breakAfter(1, s), 'short');
  assert.equal(P.breakAfter(4, s), 'long');
  assert.equal(P.breakAfter(8, s), 'long');
  assert.equal(P.nextPhase('focus', 4, s), 'long');
  assert.equal(P.nextPhase('long', 4, s), 'focus');
  // 0本の時に長い休憩へ行かない
  assert.equal(P.breakAfter(0, s), 'short');
});

test('記録は日ごとに1行だけ持つ', () => {
  const day1 = new Date(2026, 7, 29, 10).getTime();
  const day2 = new Date(2026, 7, 30, 10).getTime();
  let log = P.addSession([], day1);
  log = P.addSession(log, day1);
  log = P.addSession(log, day2);
  assert.equal(log.length, 2);
  assert.equal(P.todayCount(log, day1), 2);
  assert.equal(P.todayCount(log, day2), 1);
  assert.equal(P.totalCount(log), 3);
  assert.equal(P.activeDays(log), 2);
});

test('日付は端末の時刻帯で数える（UTCに直して前日にしない）', () => {
  // 日本時間の 0時5分。UTC に直すと前日になる時刻。
  const midnight = new Date(2026, 7, 29, 0, 5).getTime();
  assert.equal(P.dayKey(midnight), '2026-08-29');
});

// 変革ノート・鍼灸アプリと同じ約束。連続日数を主役にすると、1日休んだ時に開かなくなる。
test('連続日数を数える関数を持たない', () => {
  const src = readFileSync(new URL('../src/lib/pomodoro.js', import.meta.url), 'utf8');
  assert.equal(/streak/i.test(src), false, 'streak（連続日数）が実装されています');
  assert.equal(Object.keys(P).some((k) => /streak/i.test(k)), false);
});
