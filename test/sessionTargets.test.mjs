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

import { audioSecPerItem, nextAudioPace, PACE_MIN_SAMPLES } from '../src/lib/sessionTargets.js';
import { planStudySession } from '../src/lib/bufferSession.js';

test('実際に聞いたペースがあれば、そちらで見積もる（速度に合わせて直す）', () => {
  const pace = { sec: 30, rate: 1, n: PACE_MIN_SAMPLES };
  assert.equal(audioSecPerItem({ rate: 1.5, pace }), 20);
  // 記録が少ないうちは固定の見積もり
  assert.equal(audioSecPerItem({ rate: 1, gapSeconds: 2, nextGapSeconds: 1, pace: { sec: 30, rate: 1, n: 1 } }), 15);
});

test('ペースの記録は、長すぎる・短すぎる間を捨て、速度をそろえてならす', () => {
  assert.equal(nextAudioPace(null, 500, 1), null);
  const a = nextAudioPace(null, 20, 1);
  assert.deepEqual(a, { sec: 20, rate: 1, n: 1 });
  const b = nextAudioPace(a, 10, 2); // 2倍速で10秒＝1倍速なら20秒
  assert.equal(b.sec, 20);
  assert.equal(b.n, 2);
});

test('音声学習の3分の2バッファ術は、1問あたりの秒数を外から渡せる', () => {
  const p = planStudySession({ totalMinutes: 60, history: [], secPerQuestionOverride: 20, standardRatio: 2 / 3 });
  assert.equal(p.secPerQuestion, 20);
  assert.equal(p.baseTaskQuestionCount, 120);
});
