import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyReview, isReviewWritten, reviewedWeeks, buildWeekSummary, managerHint, compareWeeks,
  isWeekReviewable, MANAGER_ALLOCATION_OPTIONS, MANAGER_PLAN_OPTIONS, DOER_FEEL_OPTIONS,
} from '../src/lib/weekly.js';
import { buildDefaultHabits } from '../src/lib/habits.js';
import type { DayRecord, Settings, WeeklyReview } from '../src/types/index.js';

const AT = new Date(2026, 7, 1).getTime();
const habits = buildDefaultHabits(AT);
const settings: Settings = {
  shiftEndDefault: '00:00', bedWithinMinutes: 90, offDayBedtime: '23:00',
  audioLinkEnabled: false, audioLinkUrl: '', showStreakProminently: false, meditationBell: true, meditationDefaultMinutes: 10,
  fastingTargetHours: 12,
  fastingWorkdayHours: 0,
  fastingPlan: 'three',
  fastingPlanSince: null,
  fastingPrechecks: [],
};

function day(date: string, over: Partial<DayRecord> = {}): DayRecord {
  return { date, checked: [], declaration: '', note: '', shift: null, shiftEndsAt: null, sleep: null, updatedAt: 0, ...over };
}
function daysMap(list: DayRecord[]): Record<string, DayRecord> {
  return Object.fromEntries(list.map((d) => [d.date, d]));
}

test('振り返りは3項目のうち1つでも書けていればよい（完璧を求めない）', () => {
  const empty = emptyReview('2026-08-21', AT);
  assert.equal(empty.weekStart, '2026-08-17'); // 月曜に正規化
  assert.equal(isReviewWritten(empty), false);
  assert.equal(isReviewWritten({ ...empty, good: 'できた' }), true);
  assert.equal(isReviewWritten({ ...empty, focus: '来週は' }), true);
  assert.equal(isReviewWritten({ ...empty, good: '   ' }), false);
  assert.equal(isReviewWritten(undefined), false);
});

test('書いた週の一覧を返す（ステップ⑦の自動チェックに使う）', () => {
  const weeks: Record<string, WeeklyReview> = {
    '2026-08-10': { ...emptyReview('2026-08-10', AT), good: 'できた' },
    '2026-08-17': emptyReview('2026-08-17', AT),
  };
  const done = reviewedWeeks(weeks);
  assert.equal(done.has('2026-08-10'), true);
  assert.equal(done.has('2026-08-17'), false);
});

test('週の集計は、書いた日だけを分母にする（空白の日で薄めない）', () => {
  const days = daysMap([
    day('2026-08-17', { checked: habits.map((h) => h.id) }),   // 100%
    day('2026-08-18', { checked: habits.slice(0, 4).map((h) => h.id) }), // 約57%
  ]);
  const s = buildWeekSummary('2026-08-21', days, habits, settings);
  assert.equal(s.weekStart, '2026-08-17');
  assert.equal(s.days.length, 7);
  assert.equal(s.recordedDays, 2);
  assert.ok(s.averageRate > 0.75 && s.averageRate < 0.8);
});

test('習慣ごとの達成日数と、一番できた／できなかった習慣', () => {
  const days = daysMap([
    day('2026-08-17', { checked: ['step1-peers', 'step2-onegoal'] }),
    day('2026-08-18', { checked: ['step2-onegoal'] }),
    day('2026-08-19', { checked: ['step2-onegoal'] }),
  ]);
  const s = buildWeekSummary('2026-08-19', days, habits, settings);
  assert.equal(s.best?.id, 'step2-onegoal');
  const perStep2 = s.perHabit.find((p) => p.habit.id === 'step2-onegoal')!;
  assert.equal(perStep2.done, 3);
  assert.equal(perStep2.possible, 7); // 週7日ぶん
  assert.ok(s.hardest);
});

test('記録が1日以下なら「一番できた習慣」は出さない（材料不足）', () => {
  const s = buildWeekSummary('2026-08-21', daysMap([day('2026-08-17', { checked: ['step1-peers'] })]), habits, settings);
  assert.equal(s.best, null);
  assert.equal(s.hardest, null);
});

test('勤務日数と就寝の集計が週サマリに入る', () => {
  const days = daysMap([
    day('2026-08-17', { shift: 'work', sleep: { actualAt: '01:00', crossesMidnight: true, recordedAt: 0 }, checked: ['step1-peers'] }),
    day('2026-08-18', { shift: 'off', checked: ['step1-peers'] }),
  ]);
  const s = buildWeekSummary('2026-08-18', days, habits, settings);
  assert.equal(s.workDays, 1);
  assert.equal(s.offDays, 1);
  assert.equal(s.bedtime.planned, 2);
  assert.equal(s.bedtime.met, 1);
});

test('管理者視点のヒントは「計画を直す」方向で、本人を評価しない', () => {
  const empty = buildWeekSummary('2026-08-21', {}, habits, settings);
  const hint0 = managerHint(empty, undefined);
  assert.match(hint0, /記録がありません/);

  const busy = buildWeekSummary('2026-08-21', daysMap([
    day('2026-08-17', { shift: 'work', checked: ['step1-peers'] }),
    day('2026-08-18', { shift: 'work', checked: [] }),
    day('2026-08-19', { shift: 'work', checked: [] }),
    day('2026-08-20', { shift: 'work', checked: ['step1-peers'] }),
    day('2026-08-21', { shift: 'work', checked: [] }),
  ]), habits, settings);
  const hint = managerHint(busy, undefined);
  assert.match(hint, /組み直/);

  for (const h of [hint0, hint]) {
    for (const ng of ['サボ', '怠', '意志', '甘い', 'ダメ']) {
      assert.equal(h.includes(ng), false, `責める表現が入っている: ${h}`);
    }
  }
});

test('配分の回答があれば、それに応じた具体的な直し方を返す', () => {
  const s = buildWeekSummary('2026-08-21', {}, habits, settings);
  const review = { ...emptyReview('2026-08-21', AT), manager: { planFollowed: null, allocation: 'too_much' as const, note: '' } };
  assert.match(managerHint(s, review), /2割減らして/);
});

test('先週との比較は事実だけを返す', () => {
  const cur = buildWeekSummary('2026-08-21', daysMap([day('2026-08-17', { checked: habits.map((h) => h.id) })]), habits, settings);
  const prev = buildWeekSummary('2026-08-14', daysMap([day('2026-08-10', { checked: [habits[0].id] })]), habits, settings);
  const cmp = compareWeeks(cur, prev)!;
  assert.ok(cmp.delta > 0);
  assert.match(cmp.text, /高いペース/);
  assert.equal(compareWeeks(cur, null), null);
  assert.equal(compareWeeks(cur, buildWeekSummary('2026-08-14', {}, habits, settings)), null);
});

test('週の振り返りは土曜以降にすすめる', () => {
  assert.equal(isWeekReviewable('2026-08-17', '2026-08-19'), false); // 水曜
  assert.equal(isWeekReviewable('2026-08-17', '2026-08-22'), true);  // 土曜
  assert.equal(isWeekReviewable('2026-08-17', '2026-08-23'), true);  // 日曜
});

test('選択肢の定義がそろっている', () => {
  assert.equal(MANAGER_PLAN_OPTIONS.length, 3);
  assert.equal(DOER_FEEL_OPTIONS.length, 3);
  for (const o of MANAGER_ALLOCATION_OPTIONS) {
    assert.ok(o.advice.length > 0, '配分の選択肢には必ず直し方の助言を付ける');
  }
});

test('週の集計に瞑想が入り、主役は「した日数」', () => {
  const days = daysMap([
    { ...day('2026-08-17', { checked: ['step1-peers'] }), meditations: [{ minutes: 10, recordedAt: 0 }] },
    { ...day('2026-08-18', { checked: ['step1-peers'] }), meditations: [{ minutes: 10, recordedAt: 0 }, { minutes: 3, recordedAt: 0 }] },
    day('2026-08-19', { checked: ['step1-peers'] }),
  ]);
  const s = buildWeekSummary('2026-08-19', days, habits, settings);
  assert.equal(s.meditation.days, 2);
  assert.equal(s.meditation.sessions, 3);
  assert.equal(s.meditation.totalMinutes, 23);
});

test('瞑想が週1〜3日なら、長さより「置く日を増やす」ほうを助言する', () => {
  const list = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'].map((d, i) => ({
    ...day(d, { checked: ['step1-peers'] }),
    meditations: i === 0 ? [{ minutes: 60, recordedAt: 0 }] : [],
  }));
  const s = buildWeekSummary('2026-08-21', daysMap(list), habits, settings);
  const hint = managerHint(s, undefined);
  assert.match(hint, /置く日を増やす/);
  assert.match(hint, /3分/);
});
