import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUTINE_STEPS, STEP_MAP, PRESETS, planMinutes, planOrder, activeSteps, totalMinutes,
  checkAffirmation, normalizeAffirmations, AFFIRMATION_SLOTS,
  emptyRoutine, routineOf, WAKE_FIRST_NOTE, WATER_ON_WAKING_NOTE, BEDTIME_MINDSET_NOTE,
  sleepPhrase, hoursUntilWake, minutesFromWake, startedQuickly, ZERO_MORNING_LIMIT,
  didRoutine, summarizeRoutine, ROUTINE_UNVERIFIED,
} from '../src/lib/morningRoutine.js';
import { testSettings } from './fixtures.js';
import type { RoutineRecord } from '../src/types/index.js';

const rec = (over: Partial<RoutineRecord> = {}) => ({ routine: { ...emptyRoutine(), ...over } });

test('6つのステップがそろい、やり方の説明を持つ', () => {
  assert.equal(ROUTINE_STEPS.length, 6);
  assert.deepEqual(ROUTINE_STEPS.map((s) => s.id),
    ['meditation', 'affirmation', 'visualize', 'exercise', 'reading', 'journal']);
  for (const s of ROUTINE_STEPS) {
    assert.ok(s.title && s.reading && s.icon);
    assert.ok(s.how.length > 20, `${s.id} にやり方が要る`);
  }
  assert.equal(STEP_MAP.journal.title, 'ジャーナル');
});

test('60分版は出典の配分どおりで、合計60分になる', () => {
  const s = testSettings({ routinePreset: 'full' });
  const m = planMinutes(s);
  assert.deepEqual(m, { meditation: 5, affirmation: 5, visualize: 5, exercise: 20, reading: 20, journal: 5 });
  assert.equal(totalMinutes(s), 60);
});

test('6分版は各1分で合計6分', () => {
  const s = testSettings({ routinePreset: 'short' });
  assert.equal(totalMinutes(s), 6);
  assert.equal(activeSteps(s).length, 6);
});

test('自分で決める：0分にしたステップは実行から外れる', () => {
  const s = testSettings({
    routinePreset: 'custom',
    routineCustomMinutes: { meditation: 15, affirmation: 1, visualize: 5, exercise: 20, reading: 10, journal: 10 },
  });
  assert.equal(totalMinutes(s), 61);
  const skipped = testSettings({
    routinePreset: 'custom',
    routineCustomMinutes: { meditation: 10, affirmation: 0, visualize: 0, exercise: 20, reading: 0, journal: 5 },
  });
  assert.deepEqual(activeSteps(skipped).map((x) => x.id), ['meditation', 'exercise', 'journal']);
  assert.equal(totalMinutes(skipped), 35);
});

test('順番を変えられる（解説者自身も入れ替えている）', () => {
  const s = testSettings({ routineOrder: ['exercise', 'meditation'] });
  const order = planOrder(s).map((x) => x.id);
  assert.equal(order[0], 'exercise');
  assert.equal(order[1], 'meditation');
  assert.equal(order.length, 6, '並べ替えても全部残る');
  // 知らないidは無視する（古い設定でも落ちない）
  assert.equal(planOrder(testSettings({ routineOrder: ['なぞ', 'journal'] }))[0].id, 'journal');
  assert.deepEqual(planOrder(testSettings({ routineOrder: [] })).map((x) => x.id), ROUTINE_STEPS.map((x) => x.id));
});

test('アファメーションは数字と期限が入っているかを見る（止めはしない）', () => {
  assert.equal(checkAffirmation('2027年3月までに国家試験に合格する').ok, true);
  const noNum = checkAffirmation('国家試験に合格するまでがんばる');
  assert.equal(noNum.ok, false);
  assert.deepEqual(noNum.missing, ['数字']);
  assert.match(noNum.hint, /数字/);
  const noDeadline = checkAffirmation('登録者10000人');
  assert.deepEqual(noDeadline.missing, ['期限']);
  const empty = checkAffirmation('  ');
  assert.deepEqual(empty.missing, ['本文']);
});

test('アファメーションは常に3枠', () => {
  assert.deepEqual(normalizeAffirmations(undefined), ['', '', '']);
  assert.equal(normalizeAffirmations(['a', 'b', 'c', 'd']).length, AFFIRMATION_SLOTS);
  assert.equal(normalizeAffirmations(['あ'.repeat(200)])[0].length, 80);
});

test('「朝」を前提にしない（夜勤でも実行できる）', () => {
  assert.match(WAKE_FIRST_NOTE, /必ずしも朝にやる必要はない/);
  assert.match(WAKE_FIRST_NOTE, /夜勤/);
  assert.match(WAKE_FIRST_NOTE, /時計ではなく、起きてから/);
});

test('寝る前の言い方に「しか」を使わない', () => {
  const p = sleepPhrase(5);
  assert.match(p, /5時間も眠れます/);
  assert.equal(p.includes('しか'), false);
  for (const h of [3, 4.5, 6, 8]) {
    assert.equal(sleepPhrase(h).includes('しか'), false, `${h}時間の文に「しか」が入っている`);
  }
  // 本人1人の実験である旨を残す
  assert.match(BEDTIME_MINDSET_NOTE, /本人1人/);
  assert.match(BEDTIME_MINDSET_NOTE, /※要確認/);
});

test('眠れる時間の計算。日をまたいでも合う', () => {
  // 就寝目標が翌01:30（=1530分）、起床7:00 → 5.5時間
  assert.equal(hoursUntilWake(1530, '07:00'), 5.5);
  // 23:00（=1380分）就寝、7:00起床 → 8時間
  assert.equal(hoursUntilWake(1380, '07:00'), 8);
  assert.equal(hoursUntilWake(null, '07:00'), null);
  assert.equal(hoursUntilWake(1380, null), null);
  assert.equal(hoursUntilWake(1380, 'こわれた'), null);
});

test('起きてから始めるまでの分。ゴーストモード④と同じ基準で見る', () => {
  assert.equal(ZERO_MORNING_LIMIT, 20);
  assert.equal(minutesFromWake(rec({ wakeAt: '06:00', startedAt: '06:15' })), 15);
  assert.equal(startedQuickly(rec({ wakeAt: '06:00', startedAt: '06:15' })), true);
  assert.equal(startedQuickly(rec({ wakeAt: '06:00', startedAt: '07:00' })), false);
  // 夜勤明けで日をまたいで起きた場合
  assert.equal(minutesFromWake(rec({ wakeAt: '23:40', startedAt: '00:05' })), 25);
  // 記録が無ければ判定しない
  assert.equal(startedQuickly(rec({ wakeAt: '06:00' })), null);
  assert.equal(startedQuickly(undefined), null);
});

test('1つでもやれば「やった日」', () => {
  assert.equal(didRoutine(rec({ doneSteps: ['meditation'] })), true);
  assert.equal(didRoutine(rec()), false);
  assert.equal(didRoutine(undefined), false);
  assert.deepEqual(routineOf(undefined), emptyRoutine());
});

test('週の集計。連続日数は数えない', () => {
  const days = [
    rec({ doneSteps: ['meditation', 'journal'], wakeAt: '06:00', startedAt: '06:10', waterOnWaking: true }),
    rec({ doneSteps: ['meditation'], wakeAt: '06:00', startedAt: '07:30' }),
    rec({ doneSteps: ['meditation', 'exercise'], waterOnWaking: true }),
    rec(),
    undefined,
  ];
  const s = summarizeRoutine(days);
  assert.equal(s.days, 3);
  assert.equal(s.quickDays, 1);
  assert.equal(s.waterDays, 2);
  assert.equal(s.steps.find((x) => x.step.id === 'meditation')!.days, 3);
  assert.equal(s.steps.find((x) => x.step.id === 'visualize')!.days, 0);
  assert.equal('streak' in s, false);
  assert.ok(s.weakest);
  assert.equal(s.weakest!.days, 0);
});

test('記録が2日以下なら、一番できていないステップを言い切らない', () => {
  assert.equal(summarizeRoutine([rec({ doneSteps: ['meditation'] }), rec({ doneSteps: ['meditation'] })]).weakest, null);
  assert.equal(summarizeRoutine([]).days, 0);
});

test('既存機能へ書き込むステップが決まっている（同じことを2か所に記録しない）', () => {
  assert.equal(STEP_MAP.meditation.writesTo, 'meditation');
  assert.equal(STEP_MAP.exercise.writesTo, 'workout');
  assert.equal(STEP_MAP.reading.writesTo, 'reading');
  assert.equal(STEP_MAP.journal.writesTo, 'threeRules');
  // アファメーションとイメージングは書き込み先を持たない（このアプリに対応する記録が無い）
  assert.equal(STEP_MAP.affirmation.writesTo, undefined);
  assert.equal(STEP_MAP.visualize.writesTo, undefined);
});

test('断定しないものが並んでいる', () => {
  const ids = ROUTINE_UNVERIFIED.map((c) => c.id);
  for (const need of ['weeks', 'early_success', 'affirm_rate', 'hippocampus', 'recording_diet', 'sleep_experiment', 'no_breakfast']) {
    assert.ok(ids.includes(need), `${need} を扱う`);
  }
  // 早起き＝成功、の取り違えに触れる
  assert.match(ROUTINE_UNVERIFIED.find((c) => c.id === 'early_success')!.note, /原因だとは限りません/);
  // 朝食抜きは、既に慎重に作った食事機能へ回す
  const breakfast = ROUTINE_UNVERIFIED.find((c) => c.id === 'no_breakfast')!;
  assert.equal(breakfast.hard, true);
  assert.match(breakfast.note, /食事の時間と量/);
});

test('水のひとことがある', () => {
  assert.match(WATER_ON_WAKING_NOTE, /水/);
  assert.match(WATER_ON_WAKING_NOTE, /スマホ/);
});

test('プリセットは3つ', () => {
  assert.deepEqual(PRESETS.map((p) => p.id), ['full', 'short', 'custom']);
  for (const p of PRESETS) assert.ok(p.note.length > 0);
});
