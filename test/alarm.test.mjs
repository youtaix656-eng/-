import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeAlarm, isAlarmDue, dueAlarms, markFired, snoozeAlarm, nextRingAt, untilText, repeatText,
  parseTime, sortAlarms, ALARM_GRACE_MS,
} from '../src/lib/alarm.js';
import { ALARM_SOUNDS, alarmSoundById } from '../src/lib/alarmSounds.js';

const at = (y, mo, d, h, mi, s = 0) => new Date(y, mo - 1, d, h, mi, s).getTime();
// 2026-11-16 は月曜
const created = at(2026, 11, 15, 22, 0);

test('parseTime：不正な時刻はnull', () => {
  assert.deepEqual(parseTime('7:05'), { h: 7, min: 5 });
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime(''), null);
});

test('makeAlarm：時刻を0埋めし、曜日は重複を除いて並べる。時刻が不正ならnull', () => {
  const a = makeAlarm({ time: '7:05', days: [3, 1, 1, 9] }, created);
  assert.equal(a.time, '07:05');
  assert.deepEqual(a.days, [1, 3]);
  assert.equal(a.enabled, true);
  assert.equal(makeAlarm({ time: 'xx' }), null);
});

test('isAlarmDue：予定時刻の前は鳴らさず、時刻になったら鳴らす', () => {
  const a = makeAlarm({ time: '07:00' }, created);
  assert.equal(isAlarmDue(a, at(2026, 11, 16, 6, 59, 59)), false);
  assert.equal(isAlarmDue(a, at(2026, 11, 16, 7, 0, 0)), true);
});

test('isAlarmDue：タブが裏で遅れても10分以内なら鳴らし、それを過ぎたら鳴らさない', () => {
  const a = makeAlarm({ time: '07:00' }, created);
  assert.equal(isAlarmDue(a, at(2026, 11, 16, 7, 9, 59)), true);
  assert.equal(isAlarmDue(a, at(2026, 11, 16, 7, 0) + ALARM_GRACE_MS), false);
});

test('isAlarmDue：作った時点ですでに過ぎていた時刻では即鳴らさない（翌日に鳴る）', () => {
  const a = makeAlarm({ time: '07:00' }, at(2026, 11, 16, 7, 5));
  assert.equal(isAlarmDue(a, at(2026, 11, 16, 7, 5, 1)), false);
  assert.equal(isAlarmDue(a, at(2026, 11, 17, 7, 0, 1)), true);
});

test('isAlarmDue：オフなら鳴らさない。曜日指定は合う曜日だけ', () => {
  const off = makeAlarm({ time: '07:00', enabled: false }, created);
  assert.equal(isAlarmDue(off, at(2026, 11, 16, 7, 0)), false);
  const tue = makeAlarm({ time: '07:00', days: [2] }, created);
  assert.equal(isAlarmDue(tue, at(2026, 11, 16, 7, 0)), false); // 月曜
  assert.equal(isAlarmDue(tue, at(2026, 11, 17, 7, 0)), true); // 火曜
});

test('markFired：同じ回を2度鳴らさない。1回だけのアラームはオフになる', () => {
  const now = at(2026, 11, 16, 7, 0, 1);
  const once = markFired(makeAlarm({ time: '07:00' }, created), now);
  assert.equal(once.enabled, false);
  assert.equal(isAlarmDue(once, now + 1000), false);
  const daily = markFired(makeAlarm({ time: '07:00', days: [0, 1, 2, 3, 4, 5, 6] }, created), now);
  assert.equal(daily.enabled, true);
  assert.equal(isAlarmDue(daily, now + 1000), false);
  assert.equal(isAlarmDue(daily, at(2026, 11, 17, 7, 0, 0)), true); // 翌日はまた鳴る
});

test('snoozeAlarm：5分後にもう一度だけ鳴る（1回だけのアラームでも）', () => {
  const now = at(2026, 11, 16, 7, 0, 1);
  const s = snoozeAlarm(markFired(makeAlarm({ time: '07:00' }, created), now), now);
  assert.equal(s.enabled, true);
  assert.equal(isAlarmDue(s, now + 4 * 60 * 1000), false);
  assert.equal(isAlarmDue(s, now + 5 * 60 * 1000), true);
  const after = markFired(s, now + 5 * 60 * 1000);
  assert.equal(after.snoozeUntil, null);
  assert.equal(after.enabled, false);
});

test('dueAlarms：鳴らすものだけ返す。配列でなくても落ちない', () => {
  const a = makeAlarm({ time: '07:00' }, created);
  const b = makeAlarm({ time: '08:00' }, created);
  assert.deepEqual(dueAlarms([a, b], at(2026, 11, 16, 7, 0)).map((x) => x.time), ['07:00']);
  assert.deepEqual(dueAlarms(undefined, Date.now()), []);
});

test('nextRingAt：今日の時刻が過ぎていれば次の該当日。オフはnull', () => {
  const now = at(2026, 11, 16, 8, 0); // 月曜8時
  assert.equal(nextRingAt(makeAlarm({ time: '07:00' }, created), now), at(2026, 11, 17, 7, 0));
  assert.equal(nextRingAt(makeAlarm({ time: '09:00' }, created), now), at(2026, 11, 16, 9, 0));
  assert.equal(nextRingAt(makeAlarm({ time: '07:00', days: [1] }, created), now), at(2026, 11, 23, 7, 0));
  assert.equal(nextRingAt(makeAlarm({ time: '07:00', enabled: false }, created), now), null);
});

test('untilText・repeatText・sortAlarms', () => {
  assert.equal(untilText(90 * 60 * 1000), 'あと1時間30分');
  assert.equal(untilText(30 * 1000), 'あと1分');
  assert.equal(untilText(25 * 60 * 60 * 1000), 'あと1日1時間');
  assert.equal(repeatText([]), '1回だけ');
  assert.equal(repeatText([0, 1, 2, 3, 4, 5, 6]), '毎日');
  assert.equal(repeatText([1, 2, 3, 4, 5]), '平日');
  assert.equal(repeatText([1, 3]), '月・水');
  assert.deepEqual(sortAlarms([{ time: '09:00' }, { time: '07:00' }]).map((a) => a.time), ['07:00', '09:00']);
});

test('アラーム音：ちょうど20種類。id・名前が重複せず、どれも音符を持つ', () => {
  assert.equal(ALARM_SOUNDS.length, 20);
  assert.equal(new Set(ALARM_SOUNDS.map((s) => s.id)).size, 20);
  assert.equal(new Set(ALARM_SOUNDS.map((s) => s.name)).size, 20);
  for (const s of ALARM_SOUNDS) {
    assert.ok(s.notes.length > 0, s.id);
    assert.ok(s.loop > 0, s.id);
    for (const [t, f, d] of s.notes) {
      assert.ok(t >= 0 && f > 20 && f < 8000 && d > 0, s.id);
      assert.ok(t + d <= s.loop + 0.5, `${s.id}：フレーズがくり返しの間隔に収まる`);
    }
  }
  assert.equal(alarmSoundById('nope').id, 'bell');
});
