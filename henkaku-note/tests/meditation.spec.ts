import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recommendMinutes, shouldWarnJump, effectStageFor, nextStage, summarize, pastMinutesOf,
  formatRemaining, EFFECT_STAGES, LENGTH_OPTIONS, LENGTH_MAP, MINUTE_STEPS,
} from '../src/lib/meditation.js';
import { HABIT_PRESETS, MEDITATION_SOURCE, presetToHabit, MEDITATION_HABIT_ID } from '../src/data/presets.js';

const AT = new Date(2026, 7, 21).getTime();
const s = (minutes: number) => ({ minutes, recordedAt: AT });

test('最初は10分をすすめる（最小単位）', () => {
  const r = recommendMinutes([]);
  assert.equal(r.minutes, 10);
  assert.match(r.reason, /最小単位/);
});

test('回数が足りないうちは長さを上げない', () => {
  for (let n = 1; n <= 4; n += 1) {
    const r = recommendMinutes(Array(n).fill(10));
    assert.equal(r.minutes, 10, `${n}回でまだ10分のまま`);
    assert.match(r.reason, /あと\d回/);
  }
});

test('5回できたら1段階だけ上げる（いきなり60分にしない）', () => {
  const r10 = recommendMinutes(Array(5).fill(10));
  assert.equal(r10.minutes, 20);
  const r20 = recommendMinutes([...Array(5).fill(10), ...Array(5).fill(20)]);
  assert.equal(r20.minutes, 30);
  const r30 = recommendMinutes([...Array(5).fill(20), ...Array(5).fill(30)]);
  assert.equal(r30.minutes, 60);
});

test('段階は一度に2つ飛ばさない', () => {
  // 10分を20回やっても、次は20分（30分にはしない）
  assert.equal(recommendMinutes(Array(20).fill(10)).minutes, 20);
});

test('一番上まで来たら、その長さを続けるようすすめる', () => {
  const r = recommendMinutes([...Array(5).fill(30), ...Array(5).fill(60)]);
  assert.equal(r.minutes, 60);
  assert.match(r.reason, /続ける/);
});

test('3分は逃げ道であって段階には含めない', () => {
  // 3分を10回やっても、すすめる長さは10分のまま（3分では段階が上がらない）
  assert.equal(recommendMinutes(Array(10).fill(3)).minutes, 10);
  assert.ok(MINUTE_STEPS.includes(3 as never));
});

test('普段より大きく飛ばした長さには注意を出す（初心者がいきなり1時間）', () => {
  assert.equal(shouldWarnJump(60, []), true);
  assert.equal(shouldWarnJump(20, []), true);
  assert.equal(shouldWarnJump(10, []), false);
  assert.equal(shouldWarnJump(3, []), false);
  // 10分を積んだ人が20分 → 1段階なので警告なし
  assert.equal(shouldWarnJump(20, Array(5).fill(10)), false);
  // 10分の人がいきなり60分 → 警告
  assert.equal(shouldWarnJump(60, Array(5).fill(10)), true);
  // 30分をやっている人の60分 → 1段階なので警告なし
  assert.equal(shouldWarnJump(60, Array(5).fill(30)), false);
});

test('効果の段階は「実践した日数」で決まる（合計分数ではない）', () => {
  assert.equal(effectStageFor(0), null);
  assert.equal(effectStageFor(1)?.id, 'session');
  assert.equal(effectStageFor(13)?.id, 'session');
  assert.equal(effectStageFor(14)?.id, 'weeks');
  assert.equal(effectStageFor(30)?.id, 'months');
  assert.equal(effectStageFor(56)?.id, 'mbsr8w');
  assert.equal(effectStageFor(365)?.id, 'long');
});

test('次の段階と残り日数を返す', () => {
  assert.equal(nextStage(0)?.stage.id, 'session');
  assert.equal(nextStage(10)?.remaining, 4);
  assert.equal(nextStage(10)?.stage.id, 'weeks');
  assert.equal(nextStage(400), null);
});

test('効果は断定しない書き方になっている（保証と読めない）', () => {
  for (const stage of EFFECT_STAGES) {
    assert.ok(stage.reported.length > 0);
    for (const line of stage.reported) {
      for (const ng of ['必ず', '確実に', '保証', '誰でも']) {
        assert.equal(line.includes(ng), false, `断定表現が入っている: ${line}`);
      }
    }
  }
  // 研究水準の段階には、一次資料未確認である旨を残す
  assert.match(String(EFFECT_STAGES.find((s2) => s2.id === 'mbsr8w')!.note), /要確認/);
});

test('集計は「実践した日数」を主役にする', () => {
  const byDate = {
    '2026-08-17': [s(10)],
    '2026-08-18': [s(10), s(3)],
    '2026-08-19': [],
    '2026-08-20': undefined,
    '2026-08-21': [s(60)],
  };
  const sum = summarize(byDate);
  assert.equal(sum.days, 3);
  assert.equal(sum.sessions, 4);
  assert.equal(sum.totalMinutes, 83);
  assert.equal(sum.longest, 60);
  assert.equal(sum.averageMinutes, 28);
});

test('空でも落ちない', () => {
  const sum = summarize({});
  assert.deepEqual([sum.days, sum.sessions, sum.totalMinutes, sum.averageMinutes, sum.longest], [0, 0, 0, 0, 0]);
  assert.deepEqual(pastMinutesOf({}), []);
});

test('過去のセッション長を平らに取り出す', () => {
  assert.deepEqual(pastMinutesOf({ a: [s(10), s(20)], b: undefined, c: [s(3)] }).sort((x, y) => x - y), [3, 10, 20]);
});

test('残り時間の表示', () => {
  assert.equal(formatRemaining(600), '10:00');
  assert.equal(formatRemaining(59.2), '1:00');
  assert.equal(formatRemaining(5), '0:05');
  assert.equal(formatRemaining(-3), '0:00');
});

test('長さの説明に、要約から取った注意が入っている', () => {
  assert.match(String(LENGTH_MAP[10].caution), /入り口/);
  assert.match(String(LENGTH_MAP[60].caution), /逆にストレス/);
  assert.equal(LENGTH_OPTIONS.length, 5);
});

test('習慣プリセットは出典を持ち、瞑想は「やった日」で判定する', () => {
  const med = HABIT_PRESETS.find((p) => p.id === MEDITATION_HABIT_ID)!;
  assert.equal(med.sourceId, MEDITATION_SOURCE.id);
  assert.match(med.criterion, /1回でも/);
  assert.equal(med.criterion.includes('分以上'), false, '長さで判定しない');
  assert.equal(presetToHabit(med, AT).step, null);
  assert.equal(presetToHabit(med, AT).archivedAt, null);
});

test('衝動の習慣には、禁欲の効果を鵜呑みにしない注意が入っている', () => {
  const urge = HABIT_PRESETS.find((p) => p.id === 'preset-urge')!;
  assert.match(urge.note, /※要確認/);
  assert.match(urge.note, /根拠が弱い|誇張/);
  // 効果を数値で謳っていないこと
  assert.equal(/テストステロン.{0,10}(上が|向上|増加)/.test(urge.note.replace('急上昇する等', '')), false);
});

test('出典は「一次資料に当たっていない」ことを明示している', () => {
  assert.match(String(MEDITATION_SOURCE.caution), /一次資料/);
  assert.match(String(MEDITATION_SOURCE.caution), /保証ではありません/);
  assert.ok(MEDITATION_SOURCE.origin.length > 0);
});
