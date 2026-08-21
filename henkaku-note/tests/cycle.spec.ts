import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeCycle, currentCycle, cycleProgress, shouldPromptClosing, streak, totalPracticedDays,
  DEFAULT_CYCLE_DAYS, PRACTICED_THRESHOLD,
} from '../src/lib/cycle.js';
import { buildDefaultHabits } from '../src/lib/habits.js';
import { addDays } from '../src/lib/date.js';
import type { DayRecord } from '../src/types/index.js';

const AT = new Date(2026, 7, 1).getTime();
const habits = buildDefaultHabits(AT);
const ALL = habits.map((h) => h.id);
const HALF = habits.slice(0, 4).map((h) => h.id); // 4/7 ≒ 0.57 → 実践した日

function practicedDays(start: string, count: number): Record<string, DayRecord> {
  const out: Record<string, DayRecord> = {};
  for (let i = 0; i < count; i += 1) {
    const date = addDays(start, i);
    out[date] = { date, checked: ALL, declaration: '', note: '', shift: null, shiftEndsAt: null, sleep: null, updatedAt: 0 };
  }
  return out;
}

test('実践期間は既定30日（ゴーストモードの推奨＝最低1ヶ月）', () => {
  const c = makeCycle('2026-08-01', '鍼灸国試の合格', AT);
  assert.equal(c.lengthDays, DEFAULT_CYCLE_DAYS);
  assert.equal(c.endedAt, null);
  assert.equal(c.decision, null);
  assert.equal(c.goal, '鍼灸国試の合格');
  // 極端な長さは丸める（無期限の実践は想定しない）
  assert.equal(makeCycle('2026-08-01', '', AT, 3).lengthDays, 7);
  assert.equal(makeCycle('2026-08-01', '', AT, 9999).lengthDays, 120);
});

test('終わっていない期間だけを「今の期間」として返す', () => {
  const done = { ...makeCycle('2026-06-01', '前の期間', AT), endedAt: AT };
  const now = makeCycle('2026-08-01', '今の期間', AT);
  assert.equal(currentCycle([done, now])?.goal, '今の期間');
  assert.equal(currentCycle([done]), null);
  assert.equal(currentCycle([]), null);
});

test('進み具合は「◯日目 / 全◯日」と、実践できた日数を返す', () => {
  const c = makeCycle('2026-08-01', '目標', AT);
  const p = cycleProgress(c, practicedDays('2026-08-01', 5), habits, '2026-08-10');
  assert.equal(p.dayNumber, 10);
  assert.equal(p.lengthDays, 30);
  assert.equal(p.practicedDays, 5);
  assert.equal(p.remaining, 20);
  assert.equal(p.reachedEnd, false);
  assert.equal(p.endDate, '2026-08-30');
});

test('未来の日は数えない・期間より先には進まない', () => {
  const c = makeCycle('2026-08-01', '目標', AT);
  const p = cycleProgress(c, practicedDays('2026-08-01', 30), habits, '2026-08-05');
  assert.equal(p.practicedDays, 5);
  const over = cycleProgress(c, practicedDays('2026-08-01', 30), habits, '2026-09-20');
  assert.equal(over.dayNumber, 30);
  assert.equal(over.reachedEnd, true);
  assert.equal(over.remaining, 0);
});

test('期間の終わりに達したら、続けるかどうかを本人に聞く', () => {
  const c = makeCycle('2026-08-01', '目標', AT);
  assert.equal(shouldPromptClosing(cycleProgress(c, {}, habits, '2026-08-10')), false);
  assert.equal(shouldPromptClosing(cycleProgress(c, {}, habits, '2026-08-30')), true);
  assert.equal(shouldPromptClosing(null), false);
  const closed = { ...c, endedAt: AT };
  assert.equal(shouldPromptClosing(cycleProgress(closed, {}, habits, '2026-08-30')), false);
});

test('達成率が半分以上の日を「実践した日」と数える（全部できた日だけでは続かない）', () => {
  const days: Record<string, DayRecord> = {
    '2026-08-01': { date: '2026-08-01', checked: HALF, declaration: '', note: '', shift: null, shiftEndsAt: null, sleep: null, updatedAt: 0 },
    '2026-08-02': { date: '2026-08-02', checked: [habits[0].id], declaration: '', note: '', shift: null, shiftEndsAt: null, sleep: null, updatedAt: 0 },
  };
  assert.ok(HALF.length / habits.length >= PRACTICED_THRESHOLD);
  assert.equal(totalPracticedDays(days, habits), 1);
});

test('連続日数：今日まだ書いていなくても途切れ扱いにしない', () => {
  const days = practicedDays('2026-08-15', 5); // 8/15〜8/19
  // 8/20 は未記録だが、直前まで続いているので 5 のまま
  assert.equal(streak(days, habits, '2026-08-20').current, 5);
  // 8/19 の時点でも同じ
  assert.equal(streak(days, habits, '2026-08-19').current, 5);
  // 2日空くと途切れる
  assert.equal(streak(days, habits, '2026-08-21').current, 0);
});

test('連続日数：これまでで一番長かった期間も返す', () => {
  const days = { ...practicedDays('2026-08-01', 6), ...practicedDays('2026-08-15', 3) };
  const s = streak(days, habits, '2026-08-17');
  assert.equal(s.longest, 6);
  assert.equal(s.current, 3);
});

test('昨日で途切れた場合が分かる（今日から戻せると伝えるため）', () => {
  const days = practicedDays('2026-08-15', 5); // 〜8/19
  const s = streak(days, habits, '2026-08-21'); // 8/20 が空き
  assert.equal(s.current, 0);
  assert.equal(s.brokenYesterday, true);
});

test('通算の実践日数は途切れても消えない（ここを主役に出す）', () => {
  const days = { ...practicedDays('2026-08-01', 6), ...practicedDays('2026-08-15', 3) };
  assert.equal(totalPracticedDays(days, habits), 9);
  assert.equal(streak(days, habits, '2026-08-25').current, 0);
});

test('記録が空でも落ちない', () => {
  assert.equal(totalPracticedDays({}, habits), 0);
  const s = streak({}, habits, '2026-08-21');
  assert.deepEqual([s.current, s.longest, s.brokenYesterday], [0, 0, false]);
});
