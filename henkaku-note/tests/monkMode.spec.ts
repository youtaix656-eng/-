import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MONK_DAYS, MONK_PERIOD_NOTE, MONK_AREAS, SNS_RULES, SNS_RULE_MAP, DEFAULT_TARGETS,
  emptyMonk, monkOf, areaDone, GOLDEN_HOURS, goldenWindow, weeklyMonk, bodyReminder,
  CONFLICTS, isolationWarning, MONK_UNVERIFIED, MONK_PRECHECKS, MONK_PRECHECK_NOTICE,
} from '../src/lib/monkMode.js';
import { testSettings } from './fixtures.js';
import type { DayRecord, MonkRecord } from '../src/types/index.js';

const settings = testSettings();

function day(date: string, m: Partial<MonkRecord> = {}, over: Partial<DayRecord> = {}): DayRecord {
  return {
    date, checked: [], declaration: '', note: '', shift: null, shiftEndsAt: null, sleep: null, updatedAt: 0,
    monk: { ...emptyMonk(), ...m }, ...over,
  };
}
const map = (list: DayRecord[]) => Object.fromEntries(list.map((d) => [d.date, d]));
const WEEK = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'];

test('66日は「連続」ではなく「累計」でよい、と書いてある', () => {
  assert.equal(MONK_DAYS, 66);
  assert.match(MONK_PERIOD_NOTE, /累計/);
  assert.match(MONK_PERIOD_NOTE, /18〜254日/);
  assert.match(MONK_PERIOD_NOTE, /※要確認/);
});

test('3つの領域がそろっていて、理由を持つ', () => {
  assert.deepEqual(MONK_AREAS.map((a) => a.id), ['mind', 'body', 'spirit']);
  for (const a of MONK_AREAS) {
    assert.ok(a.title && a.reading && a.icon);
    assert.ok(a.why.length > 30);
  }
  // 運動が唯一のストレス発散、という出典の要点が肉体の理由に入っている
  assert.match(MONK_AREAS.find((a) => a.id === 'body')!.why, /ストレス発散/);
});

test('記録が無くても既定値で読める', () => {
  assert.deepEqual(monkOf(undefined), emptyMonk());
  for (const a of MONK_AREAS) assert.equal(areaDone(undefined, a.id, settings), false);
});

test('マインド：SNS・読書・一人の時間のどれかで置けた日', () => {
  assert.equal(areaDone(day('x', { snsRuleKept: true }), 'mind', settings), true);
  assert.equal(areaDone(day('x', { readingMinutes: 10 }), 'mind', settings), true);
  assert.equal(areaDone(day('x', { soloMinutes: 30 }), 'mind', settings), true);
  assert.equal(areaDone(day('x', { snsRuleKept: false }), 'mind', settings), false);
});

test('肉体：水・歩数・運動のどれかで置けた日', () => {
  assert.equal(areaDone(day('x', { waterMl: 2000 }), 'body', settings), true);
  assert.equal(areaDone(day('x', { waterMl: 1500 }), 'body', settings), false);
  assert.equal(areaDone(day('x', { steps: 8000 }), 'body', settings), true);
  assert.equal(areaDone(day('x', { workoutMinutes: 30 }), 'body', settings), true);
});

test('心：瞑想の記録をそのまま使う（同じことを2回記録させない）', () => {
  assert.equal(areaDone(day('x', {}, { meditations: [{ minutes: 10, recordedAt: 0 }] }), 'spirit', settings), true);
  assert.equal(areaDone(day('x', {}), 'spirit', settings), false);
});

test('運動後の集中しやすい時間帯。記録が無ければ出さない', () => {
  assert.equal(GOLDEN_HOURS, 3);
  const g = goldenWindow(day('x', { workoutAt: '07:30' }))!;
  assert.equal(g.label, '10:30');
  assert.match(g.text, /集中しやすいとされます/);
  // 夜に運動すれば翌日にまたぐ
  assert.equal(goldenWindow(day('x', { workoutAt: '22:00' }))!.label, '翌01:00');
  assert.equal(goldenWindow(day('x', {})), null);
  assert.equal(goldenWindow(undefined), null);
});

test('週の集計。歩数は記録した日だけで平均を出す（0の日で薄めない）', () => {
  const days = map([
    day('2026-08-31', { steps: 10000, waterMl: 2000, workoutMinutes: 60, readingMinutes: 30, snsRuleKept: true }),
    day('2026-09-01', { steps: 6000, waterMl: 1000, readingMinutes: 15 }),
    day('2026-09-02', { workoutMinutes: 45, soloMinutes: 90 }),
  ]);
  const w = weeklyMonk(days, WEEK, settings);
  assert.equal(w.waterDays, 1);
  assert.equal(w.stepDays, 1);
  assert.equal(w.averageSteps, 8000); // 10000と6000の平均。記録の無い日は入れない
  assert.equal(w.workouts, 2);
  assert.equal(w.workoutMinutes, 105);
  assert.equal(w.readingMinutes, 45);
  assert.equal(w.snsKeptDays, 1);
  assert.equal(w.soloMinutes, 90);
  assert.equal(w.workoutOnTrack, false);
});

test('歩数の記録が1日も無ければ平均を出さない（0にしない）', () => {
  assert.equal(weeklyMonk({}, WEEK, settings).averageSteps, null);
});

test('運動が足りない時だけ声をかける。足りていれば黙る', () => {
  const few = weeklyMonk(map([day('2026-08-31', { workoutMinutes: 60 })]), WEEK, settings);
  const msg = bodyReminder(few, settings);
  assert.match(msg, /あと2回/);
  assert.match(msg, /唯一のストレスの逃がし方/);

  const enough = weeklyMonk(map(WEEK.slice(0, 3).map((d) => day(d, { workoutMinutes: 60 }))), WEEK, settings);
  assert.equal(bodyReminder(enough, settings), '');
});

test('SNSの制限は、ゆるい順に3つ用意する', () => {
  assert.equal(SNS_RULES.length, 3);
  assert.deepEqual(SNS_RULES.map((r) => r.id), ['morning_off', 'pc_only', 'uninstalled']);
  for (const r of SNS_RULES) assert.ok(r.detail.length > 0);
  assert.match(SNS_RULE_MAP.pc_only.detail, /面倒さが上がって/);
});

test('既存の出典との食い違いを、隠さずに持つ', () => {
  const social = CONFLICTS.find((c) => c.id === 'social')!;
  assert.match(social.a.says, /距離/);
  assert.match(social.b.says, /15年|禁煙/);
  // アプリはどちらが正しいかを決めない
  assert.match(social.handling, /自分で決めて/);
  // 「人間関係を切る」ほうは実装していないと明記する
  assert.match(social.handling, /実装していません/);
});

test('一人の時間だけが増えて、人との接点が無い日が続いたら知らせる', () => {
  const days = map([
    day('2026-08-31', { soloMinutes: 120 }, { condition: { ferments: [], fibers: [], natureMinutes: 0, indoorNature: [], social: 'none', anxietyFelt: null, anxietyActions: [], sleepHygiene: [] } }),
    day('2026-09-01', { soloMinutes: 120 }, { condition: { ferments: [], fibers: [], natureMinutes: 0, indoorNature: [], social: 'none', anxietyFelt: null, anxietyActions: [], sleepHygiene: [] } }),
    day('2026-09-02', { soloMinutes: 120 }, { condition: { ferments: [], fibers: [], natureMinutes: 0, indoorNature: [], social: 'none', anxietyFelt: null, anxietyActions: [], sleepHygiene: [] } }),
    day('2026-09-03', {}, { condition: { ferments: [], fibers: [], natureMinutes: 0, indoorNature: [], social: 'none', anxietyFelt: null, anxietyActions: [], sleepHygiene: [] } }),
  ]);
  const w = isolationWarning(days, WEEK);
  assert.match(w, /誰とも話さなかった日が4日/);
  assert.match(w, /孤立/, '孤立という言葉で気づけるようにする');
  // 材料が足りなければ何も言わない
  assert.equal(isolationWarning({}, WEEK), '');
});

test('塩・血圧・服薬の主張には、特に強い注意を付ける', () => {
  const salt = MONK_UNVERIFIED.find((c) => c.id === 'salt')!;
  assert.equal(salt.hard, true);
  assert.match(salt.note, /血圧/);
  assert.match(salt.note, /医師に相談/);
  assert.match(salt.note, /記録も推奨もしません/, '塩の量は記録しない');

  const bp = MONK_UNVERIFIED.find((c) => c.id === 'walking_bp')!;
  assert.equal(bp.hard, true);
  assert.match(bp.note, /服薬をやめる・減らすの判断は必ず医師と/);
});

test('裏の取れない主張は、すべて注意付きで持つ', () => {
  const ids = MONK_UNVERIFIED.map((c) => c.id);
  for (const need of ['salt', 'walking_bp', 'eggs', 'books_top5', 'income', 'brain66', 'golden']) {
    assert.ok(ids.includes(need), `${need} を扱う`);
  }
  for (const c of MONK_UNVERIFIED) {
    assert.ok(c.claim.length > 0 && c.note.length > 0);
  }
  // 「確実に」と言い切る主張には、言い切れない旨を書く
  assert.match(MONK_UNVERIFIED.find((c) => c.id === 'books_top5')!.note, /「確実に」と言い切れる根拠はありません/);
});

test('塩・運動まわりの事前確認がある', () => {
  assert.equal(MONK_PRECHECKS.length, 3);
  assert.deepEqual(MONK_PRECHECKS.map((p) => p.id), ['blood_pressure', 'kidney', 'heart']);
  assert.match(MONK_PRECHECK_NOTICE, /医師に相談/);
  assert.match(MONK_PRECHECK_NOTICE, /医療の判断をしません/);
});

test('目安の値は「アプリの初期値」であって推奨ではない', () => {
  assert.equal(DEFAULT_TARGETS.waterMl, 2000);
  assert.equal(DEFAULT_TARGETS.steps, 8000);
  assert.equal(DEFAULT_TARGETS.workoutPerWeek, 3);
});
