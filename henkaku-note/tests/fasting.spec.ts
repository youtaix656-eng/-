import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANS, PLAN_MAP, nextPlan, DAYS_BEFORE_STEP_UP, fastingHours, nextMealAt, targetHoursFor,
  FULLNESS_OPTIONS, PRECHECKS, PRECHECK_NOTICE, STOP_SIGNS, pauseAdvice, stepUpAdvice,
  summarizeMeals, UNVERIFIED_CLAIMS, FOOD_GUIDE, PAUSE_THRESHOLD,
} from '../src/lib/fasting.js';
import { testSettings } from './fixtures.js';
import type { DayRecord, MealRecord } from '../src/types/index.js';

const settings = testSettings();

function meal(over: Partial<MealRecord> = {}): MealRecord {
  return { firstMealAt: null, lastMealAt: null, lastMealCrossesMidnight: false, fullness: null, signs: [], ...over };
}
function day(date: string, m?: Partial<MealRecord>, over: Partial<DayRecord> = {}): DayRecord {
  return {
    date, checked: [], declaration: '', note: '', shift: null, shiftEndsAt: null, sleep: null, updatedAt: 0,
    meal: m ? meal(m) : undefined, ...over,
  };
}

test('段階は1つずつしか上がらない（出典の「まず朝食抜きから」を実装に落とす）', () => {
  assert.equal(nextPlan('three')?.id, 'two');
  assert.equal(nextPlan('two')?.id, 'one');
  assert.equal(nextPlan('one'), null);
  // 週末だけは並列の選択肢なので、段階の上下に入らない
  assert.equal(PLAN_MAP.weekend.step, null);
  assert.equal(nextPlan('weekend'), null);
  assert.equal(PLANS.length, 4);
});

test('1日1食の説明に「ドカ食いしない」が入っている', () => {
  assert.match(PLAN_MAP.one.summary, /腹八分目/);
  assert.match(String(PLAN_MAP.one.caution), /いくらでも食べていいわけではない/);
});

test('空腹時間は日をまたいでも計算できる', () => {
  // 前日19:00 → 当日12:00 ＝ 17時間
  assert.equal(fastingHours('19:00', false, '12:00'), 17);
  // 夜勤明けで前日の食事が深夜1:00（日付をまたいだ）→ 当日13:00 ＝ 12時間
  assert.equal(fastingHours('01:00', true, '13:00'), 12);
  assert.equal(fastingHours('22:30', false, '07:00'), 8.5);
});

test('材料がそろわなければ空腹時間を出さない（0にしない）', () => {
  assert.equal(fastingHours(null, false, '12:00'), null);
  assert.equal(fastingHours('19:00', false, null), null);
  assert.equal(fastingHours('こわれた', false, '12:00'), null);
  assert.equal(fastingHours(undefined, false, undefined), null);
  // 逆転している（当日の食事のほうが前）なら出さない
  assert.equal(fastingHours('01:00', true, '00:30'), null);
});

test('次に食べてよい目安の時刻。翌日にまたぐ場合は「翌」を付ける', () => {
  assert.equal(nextMealAt('19:00', false, 12)?.label, '翌07:00');
  // 前日の食事が日付をまたいでいるので、その12時間後も記録日から見れば翌日
  assert.equal(nextMealAt('01:00', true, 12)?.label, '翌13:00');
  assert.equal(nextMealAt(null, false, 12), null);
});

test('勤務日だけ目標を短くできる（夜勤で長く空けると負担になりうる）', () => {
  assert.equal(targetHoursFor(day('x', {}, { shift: 'work' }), settings), 12); // 0なら同じ
  const eased = { ...settings, fastingWorkdayHours: 10 };
  assert.equal(targetHoursFor(day('x', {}, { shift: 'work' }), eased), 10);
  assert.equal(targetHoursFor(day('x', {}, { shift: 'off' }), eased), 12);
  assert.equal(targetHoursFor(undefined, eased), 12);
});

test('始める前の確認と、医師に相談する案内がある', () => {
  assert.equal(PRECHECKS.length, 6);
  const ids = PRECHECKS.map((p) => p.id);
  for (const need of ['blood_sugar', 'medication', 'pregnant', 'growing', 'eating_disorder', 'underweight']) {
    assert.ok(ids.includes(need), `${need} の確認が要る`);
  }
  assert.match(PRECHECK_NOTICE, /医師に相談/);
  assert.match(PRECHECK_NOTICE, /医療の判断をしません/);
});

test('止めどきのサインがそろっている', () => {
  assert.equal(STOP_SIGNS.length, 6);
  const ids = STOP_SIGNS.map((s) => s.id);
  assert.ok(ids.includes('obsessed'), '食べ物のことばかり考える、は必ず見る');
  assert.ok(ids.includes('losing'), '体重が減り続ける、は必ず見る');
});

test('サインが無い時は何も言わない（続けることを勧めない）', () => {
  const a = pauseAdvice([day('a', {}), day('b', {}), undefined]);
  assert.equal(a.shouldPause, false);
  assert.equal(a.text, '');
  assert.deepEqual(a.signs, []);
});

test('サインが積み上がったら、いったん普通に食べることをすすめる', () => {
  const a = pauseAdvice([
    day('a', { signs: ['dizzy'] }),
    day('b', { signs: ['dizzy'] }),
    day('c', { signs: ['foggy'] }),
  ]);
  assert.equal(a.signs.reduce((x, y) => x + y.count, 0), PAUSE_THRESHOLD);
  assert.equal(a.shouldPause, true);
  assert.match(a.text, /普通に食べて/);
  assert.equal(a.signs[0].id, 'dizzy');
  assert.equal(a.signs[0].count, 2);
});

test('「食べ物のことばかり考える」「体重が減り続ける」は1回でも止めどき', () => {
  assert.equal(pauseAdvice([day('a', { signs: ['obsessed'] })]).shouldPause, true);
  assert.equal(pauseAdvice([day('a', { signs: ['losing'] })]).shouldPause, true);
  // 他のサインは1回では止めどきにしない
  assert.equal(pauseAdvice([day('a', { signs: ['dizzy'] })]).shouldPause, false);
});

test('サインが出ている間は段階を上げない', () => {
  const bad = pauseAdvice([day('a', { signs: ['obsessed'] })]);
  const r = stepUpAdvice('three', 100, bad);
  assert.equal(r.canStepUp, false);
  assert.match(r.reason, /サインが出ている間は/);
});

test('日数が足りなければ段階を上げない', () => {
  const ok = pauseAdvice([]);
  const r = stepUpAdvice('three', 3, ok);
  assert.equal(r.canStepUp, false);
  assert.equal(r.next?.id, 'two');
  assert.match(r.reason, new RegExp(`あと${DAYS_BEFORE_STEP_UP - 3}日`));
});

test('続けられていれば、1段階だけ上げられる', () => {
  const r = stepUpAdvice('three', DAYS_BEFORE_STEP_UP, pauseAdvice([]));
  assert.equal(r.canStepUp, true);
  assert.equal(r.next?.id, 'two');
  // 一番上まで来たら上げない
  assert.equal(stepUpAdvice('one', 999, pauseAdvice([])).canStepUp, false);
});

test('集計は連続日数を数えない（切らさないことを目的にしない）', () => {
  const records = [
    day('2026-09-01', { lastMealAt: '19:00' }),
    day('2026-09-02', { firstMealAt: '12:00', lastMealAt: '20:00', fullness: 'eight' }),
    day('2026-09-03', { firstMealAt: '11:00', fullness: 'over', signs: ['dizzy'] }),
  ];
  const s = summarizeMeals(records, settings);
  assert.equal(s.recorded, 3);
  assert.equal(s.eightDays, 1);
  assert.equal(s.signDays, 1);
  assert.equal(s.medianFastingHours, 16); // 17時間と15時間 → 中央値は平均の16
  assert.equal('streak' in s, false);
  assert.equal('longest' in s, false);
});

test('空でも落ちない', () => {
  const s = summarizeMeals([undefined, day('x')], settings);
  assert.deepEqual([s.recorded, s.eightDays, s.signDays, s.medianFastingHours], [0, 0, 0, null]);
});

test('裏の取れない主張は、隠さず出したうえで必ず注意を添える', () => {
  const ids = UNVERIFIED_CLAIMS.map((c) => c.id);
  for (const need of ['detox', 'marathon', 'meat', 'milk', 'weight']) {
    assert.ok(ids.includes(need), `${need} を扱う`);
  }
  for (const c of UNVERIFIED_CLAIMS) {
    assert.ok(c.claim.length > 0 && c.note.length > 0);
    assert.match(c.note, /裏は取れていません|争いのある主張|個人差/);
  }
  // 医療の判断が要るものは相談へ回す
  assert.match(UNVERIFIED_CLAIMS.find((c) => c.id === 'milk')!.note, /医師|管理栄養士/);
});

test('食べるものの記録は腸内環境へ寄せる（同じことを2か所に書かせない）', () => {
  assert.match(FOOD_GUIDE.linkNote, /腸内環境/);
  assert.match(FOOD_GUIDE.body, /五低食|和食/);
});

test('満腹度の選択肢に、責める言い方が無い', () => {
  assert.equal(FULLNESS_OPTIONS.length, 3);
  for (const o of FULLNESS_OPTIONS) {
    for (const ng of ['ダメ', '失敗', '意志', 'だらしな']) {
      assert.equal(o.label.includes(ng), false, `責める表現: ${o.label}`);
    }
  }
});
