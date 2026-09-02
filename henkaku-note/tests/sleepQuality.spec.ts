import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SLEEP_CRITERIA, judgeSleepQuality, efficiencyOf, emptySleepQuality, durationVerdict,
  summarizeSleepQuality, FALL_ASLEEP_LIMIT, EFFICIENCY_LIMIT, SLEEP_HOURS_MIN, SLEEP_HOURS_MAX,
} from '../src/lib/sleepQuality.js';
import type { SleepQualityRecord } from '../src/types/index.js';

const good: SleepQualityRecord = {
  fallAsleepMinutes: 15, awakenings: 0, backToSleepWithin20: null, inBedMinutes: 480, sleptMinutes: 450,
};

test('本書の4条件がそろっている', () => {
  assert.equal(SLEEP_CRITERIA.length, 4);
  assert.deepEqual(SLEEP_CRITERIA.map((c) => c.id), ['fall_asleep', 'awakenings', 'back_to_sleep', 'efficiency']);
  assert.equal(FALL_ASLEEP_LIMIT, 30);
  assert.equal(EFFICIENCY_LIMIT, 85);
  for (const c of SLEEP_CRITERIA) assert.ok(c.hint.length > 0, `${c.id} に対処が要る`);
});

test('全部満たしている日', () => {
  const r = judgeSleepQuality(good);
  assert.equal(r.allMet, true);
  assert.equal(r.met.length, 4);
  assert.equal(r.unmet.length, 0);
  assert.equal(r.efficiency, 94);
});

test('寝つきが30分を超えると外れる', () => {
  const r = judgeSleepQuality({ ...good, fallAsleepMinutes: 45 });
  assert.equal(r.allMet, false);
  assert.equal(r.unmet[0].id, 'fall_asleep');
  assert.match(r.unmet[0].hint, /ベッドで寝る以外/);
});

test('夜中に2回以上起きると外れる', () => {
  const r = judgeSleepQuality({ ...good, awakenings: 2, backToSleepWithin20: true });
  assert.equal(r.unmet.map((c) => c.id).includes('awakenings'), true);
});

test('起きた回数が0なら「20分以内に再入眠」は自動で満たす（答えさせない）', () => {
  assert.equal(judgeSleepQuality({ ...good, awakenings: 0 }).met.map((c) => c.id).includes('back_to_sleep'), true);
  // 1回起きたのに答えていなければ「分からない」
  const unknown = judgeSleepQuality({ ...good, awakenings: 1, backToSleepWithin20: null });
  assert.equal(unknown.unknown.map((c) => c.id).includes('back_to_sleep'), true);
  assert.equal(unknown.allMet, null);
});

test('睡眠効率は材料がそろった時だけ出す（0にしない）', () => {
  assert.equal(efficiencyOf(emptySleepQuality()), null);
  assert.equal(efficiencyOf({ ...good, inBedMinutes: 0 }), null);
  assert.equal(efficiencyOf({ ...good, sleptMinutes: null }), null);
  assert.equal(efficiencyOf({ ...good, inBedMinutes: 600, sleptMinutes: 480 }), 80);
  assert.equal(judgeSleepQuality({ ...good, inBedMinutes: 600, sleptMinutes: 480 }).unmet[0].id, 'efficiency');
});

test('何も記録していなければ判定しない（睡眠不足だと決めつけない）', () => {
  const r = judgeSleepQuality(emptySleepQuality());
  assert.equal(r.allMet, null);
  assert.equal(r.unmet.length, 0);
  assert.equal(r.unknown.length, 4);
  assert.equal(judgeSleepQuality(undefined).allMet, null);
});

test('睡眠時間は7〜9時間の範囲で見る。短くても長くても責めない', () => {
  assert.equal(durationVerdict({ ...good, sleptMinutes: 300 }).verdict, 'short');
  assert.equal(durationVerdict({ ...good, sleptMinutes: 480 }).verdict, 'in_range');
  assert.equal(durationVerdict({ ...good, sleptMinutes: 620 }).verdict, 'long');
  assert.equal(durationVerdict(undefined).verdict, 'unknown');
  assert.equal(durationVerdict({ ...good, sleptMinutes: 480 }).hours, 8);
  assert.equal(SLEEP_HOURS_MIN, 7);
  assert.equal(SLEEP_HOURS_MAX, 9);
  for (const m of [300, 480, 620]) {
    const text = durationVerdict({ ...good, sleptMinutes: m }).text;
    for (const ng of ['ダメ', '失敗', '不足しています', '守れていません']) {
      assert.equal(text.includes(ng), false, `責める表現: ${text}`);
    }
  }
});

test('期間の集計は、一番よく外れている条件を返す（3日以上の記録があるとき）', () => {
  const late = { ...good, fallAsleepMinutes: 60 };
  const s = summarizeSleepQuality([late, late, late, good]);
  assert.equal(s.recorded, 4);
  assert.equal(s.allMetDays, 1);
  assert.equal(s.weakest?.id, 'fall_asleep');
  assert.equal(s.weakestCount, 3);
});

test('記録が2日以下なら、弱いところを言い切らない', () => {
  const late = { ...good, fallAsleepMinutes: 60 };
  assert.equal(summarizeSleepQuality([late, late]).weakest, null);
  assert.equal(summarizeSleepQuality([]).recorded, 0);
  assert.equal(summarizeSleepQuality([undefined, emptySleepQuality()]).recorded, 0);
});
