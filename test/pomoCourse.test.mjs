import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COURSE_PHASES, COURSE_TOTAL_MIN, coursePhaseLabel, coursePhaseOrdinal,
  catchUpCourse, courseScheduledEnd, hhmmOf,
} from '../src/lib/pomoCourse.js';

test('COURSE_PHASES：25分勉強＋5分休憩が交互に4回ずつ、合計8コマ', () => {
  assert.equal(COURSE_PHASES.length, 8);
  for (let i = 0; i < 8; i++) {
    assert.equal(COURSE_PHASES[i].type, i % 2 === 0 ? 'study' : 'break');
    assert.equal(COURSE_PHASES[i].min, i % 2 === 0 ? 25 : 5);
  }
});

test('COURSE_TOTAL_MIN：合計が120分（2時間）になる', () => {
  assert.equal(COURSE_TOTAL_MIN, 120);
});

test('coursePhaseLabel：studyは勉強、breakは休憩', () => {
  assert.equal(coursePhaseLabel('study'), '勉強');
  assert.equal(coursePhaseLabel('break'), '休憩');
});

test('coursePhaseOrdinal：勉強1回目・休憩1回目・勉強4回目を正しく数える', () => {
  assert.deepEqual(coursePhaseOrdinal(0), { type: 'study', n: 1, total: 4 });
  assert.deepEqual(coursePhaseOrdinal(1), { type: 'break', n: 1, total: 4 });
  assert.deepEqual(coursePhaseOrdinal(6), { type: 'study', n: 4, total: 4 });
  assert.deepEqual(coursePhaseOrdinal(7), { type: 'break', n: 4, total: 4 });
});

test('catchUpCourse：まだ期限が来ていなければ何も進めない', () => {
  const now = Date.now();
  const r = catchUpCourse(0, now + 1000, now);
  assert.equal(r.phaseIndex, 0);
  assert.equal(r.finished, false);
  assert.equal(r.endAt, now + 1000);
});

test('catchUpCourse：1コマだけ期限切れなら1つだけ進む（study1→break1）', () => {
  const t0 = Date.UTC(2026, 0, 1, 10, 0, 0); // 勉強1の終わる時刻
  const r = catchUpCourse(0, t0, t0 + 1000);
  assert.equal(r.phaseIndex, 1); // 休憩1
  assert.equal(r.endAt, t0 + COURSE_PHASES[1].min * 60 * 1000);
  assert.equal(r.finished, false);
});

test('catchUpCourse：タブが長く裏に回って複数コマ経過していても、まとめて追いつく', () => {
  const t0 = Date.UTC(2026, 0, 1, 10, 0, 0); // 勉強1の終わる時刻
  // 勉強1終了から、休憩1(5分)+勉強2(25分)=30分後（休憩2の2分目）に確認した想定
  const now = t0 + 32 * 60 * 1000;
  const r = catchUpCourse(0, t0, now);
  assert.equal(r.phaseIndex, 3); // 休憩2（0:study1,1:break1,2:study2,3:break2）
  assert.equal(r.finished, false);
});

test('catchUpCourse：最後のコマ（休憩4）も終わっていればコース終了。終了時刻は固定される', () => {
  const t0 = Date.UTC(2026, 0, 1, 10, 0, 0); // 勉強1の終わる時刻（phaseIndex=0）
  // コース全体の終了時刻＝勉強1の終わる時刻 + 残り7コマの合計（5+25+5+25+5+25+5=95分）
  const restMin = COURSE_PHASES.slice(1).reduce((s, p) => s + p.min, 0);
  const totalEnd = t0 + restMin * 60 * 1000;
  // 終了からさらに2時間経ってから確認しても、終了時刻（totalEnd）は変わらない
  const now = totalEnd + 2 * 60 * 60 * 1000;
  const r = catchUpCourse(0, t0, now);
  assert.equal(r.finished, true);
  assert.equal(r.phaseIndex, COURSE_PHASES.length);
  assert.equal(r.endAt, totalEnd);
});

test('courseScheduledEnd：コース開始直後（phase0）なら、ちょうど120分後になる', () => {
  const t0 = Date.now();
  const phase0EndAt = t0 + 25 * 60 * 1000;
  const scheduled = courseScheduledEnd(0, phase0EndAt);
  assert.equal(scheduled, t0 + COURSE_TOTAL_MIN * 60 * 1000);
});

test('courseScheduledEnd：最後のコマ（休憩4）なら、そのコマの終わる時刻と同じ', () => {
  const endAt = Date.now() + 5 * 60 * 1000;
  assert.equal(courseScheduledEnd(7, endAt), endAt);
});

test('hhmmOf：HH:MM形式で返す', () => {
  const d = new Date(2026, 0, 1, 9, 5, 0);
  assert.equal(hhmmOf(d.getTime()), '09:05');
});
