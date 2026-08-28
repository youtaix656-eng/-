import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BASE_RATIO,
  averageAnswerSeconds,
  estimatedAnswerSeconds,
  baseRatioFor,
  planStudySession,
  resolveBufferUsage,
  bufferUsageLabel,
} from '../src/lib/bufferSession.js';

test('averageAnswerSeconds: サンプル不足はnull、十分あれば中央値(秒)を返す', () => {
  assert.equal(averageAnswerSeconds([], 'all'), null);
  const base = 1_700_000_000_000;
  const history = [0, 20, 40, 60, 80, 100].map((s, i) => ({ questionId: `q${i}`, at: base + s * 1000, subject: '解剖学' }));
  const avg = averageAnswerSeconds(history, 'all');
  assert.equal(avg, 20);
});

test('averageAnswerSeconds: 大きな間隔（休憩）は平均から除外される', () => {
  const base = 1_700_000_000_000;
  const history = [
    { at: base, subject: 'x' },
    { at: base + 20_000, subject: 'x' },
    { at: base + 40_000, subject: 'x' },
    { at: base + 60_000, subject: 'x' },
    { at: base + 60_000 + 20 * 60 * 1000, subject: 'x' }, // 20分の休憩（除外対象）
    { at: base + 80_000 + 20 * 60 * 1000, subject: 'x' },
    { at: base + 100_000 + 20 * 60 * 1000, subject: 'x' },
  ];
  const avg = averageAnswerSeconds(history, 'all');
  assert.equal(avg, 20);
});

test('estimatedAnswerSeconds: 履歴が無ければジャンル別デフォルトへフォールバック', () => {
  assert.equal(estimatedAnswerSeconds([], '解剖学'), 40);
  assert.equal(estimatedAnswerSeconds([], '関係法規'), 30);
  assert.equal(estimatedAnswerSeconds([], '存在しない科目'), 40);
});

test('baseRatioFor: シフト未連携なら常に標準2:1', () => {
  assert.equal(baseRatioFor({}), DEFAULT_BASE_RATIO);
  assert.equal(baseRatioFor({ shiftContext: null }), DEFAULT_BASE_RATIO);
});

test('baseRatioFor: 出勤日は比率を下げる、休日は標準', () => {
  assert.equal(baseRatioFor({ shiftContext: 'work_day' }), 0.55);
  assert.equal(baseRatioFor({ shiftContext: 'off_day' }), DEFAULT_BASE_RATIO);
});

test('baseRatioFor: 体調スコアで微調整（上限・下限でクランプ）', () => {
  const good = baseRatioFor({ shiftContext: 'off_day', conditionScore: 100 });
  const bad = baseRatioFor({ shiftContext: 'off_day', conditionScore: 0 });
  assert.ok(good > DEFAULT_BASE_RATIO);
  assert.ok(bad < DEFAULT_BASE_RATIO);
  assert.ok(baseRatioFor({ shiftContext: 'work_day', conditionScore: 0 }) >= 0.4);
});

test('planStudySession: 60分を2:1で分割し、問題数を逆算する', () => {
  const plan = planStudySession({ totalMinutes: 60, subject: '関係法規', history: [] });
  assert.equal(plan.baseTaskMinutes, 40);
  assert.equal(plan.bufferMinutes, 20);
  // 関係法規のデフォルト30秒/問 → 40分=2400秒 → 80問
  assert.equal(plan.baseTaskQuestionCount, 80);
  assert.equal(plan.bufferQuestionCount, 40);
  assert.equal(plan.bufferUsage, 'unused');
});

test('planStudySession: シフト連動時は比率が変わる', () => {
  const plan = planStudySession({ totalMinutes: 60, subject: 'all', history: [], shiftContext: 'work_day' });
  assert.equal(plan.baseTaskMinutes, 33); // 60*0.55=33
  assert.equal(plan.shiftContext, 'work_day');
});

test('resolveBufferUsage / bufferUsageLabel', () => {
  assert.equal(resolveBufferUsage(true), 'review');
  assert.equal(resolveBufferUsage(false), 'catchup');
  assert.equal(bufferUsageLabel('review'), 'ご褒美復習（気楽に取り組む復習）');
  assert.equal(bufferUsageLabel('catchup'), '積み残し消化（未完了問題の続き）');
});
