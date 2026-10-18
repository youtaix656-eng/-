import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_TARGETS, sessionTargetLabel, estimateAudioSeconds, formatEstimateMinutes } from '../src/lib/sessionTargets.js';

test('SESSION_TARGETS: 学習画面と同じ4段階', () => {
  assert.deepEqual(SESSION_TARGETS, [10, 60, 300, 900]);
});

test('sessionTargetLabel: 4つそれぞれにラベルがある', () => {
  for (const t of SESSION_TARGETS) assert.ok(sessionTargetLabel(t));
});

test('estimateAudioSeconds: 再生速度が速いほど短くなる', () => {
  const slow = estimateAudioSeconds(10, { rate: 1, gapSeconds: 2, nextGapSeconds: 1 });
  const fast = estimateAudioSeconds(10, { rate: 2, gapSeconds: 2, nextGapSeconds: 1 });
  assert.ok(fast < slow);
});

test('estimateAudioSeconds: 件数が多いほど長くなる', () => {
  const a = estimateAudioSeconds(10, {});
  const b = estimateAudioSeconds(100, {});
  assert.ok(b > a);
});

test('formatEstimateMinutes: 1分未満とそれ以外', () => {
  assert.equal(formatEstimateMinutes(20), '1分未満');
  assert.equal(formatEstimateMinutes(120), '約2分');
});
