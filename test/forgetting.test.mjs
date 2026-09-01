import test from 'node:test';
import assert from 'node:assert/strict';
import { retrievability, forgettingRisk, dailyForgettingPick } from '../src/lib/forgetting.js';

const DAY = 24 * 60 * 60 * 1000;

test('retrievability: 経過が長いほど下がる', () => {
  const now = Date.now();
  const state = { seen: 3, interval: 10, due: now, lastReviewed: now - 20 * DAY };
  const r = retrievability(state, now);
  assert.ok(r > 0 && r < 1);
});

test('retrievability: 未学習・間隔0は対象外', () => {
  assert.equal(retrievability(null), null);
  assert.equal(retrievability({ seen: 0 }), null);
  assert.equal(retrievability({ seen: 1, interval: 0 }), null);
});

test('forgettingRisk: しきい値以上をリスク高い順に返す', () => {
  const now = Date.now();
  const q1 = { id: 'q1' };
  const q2 = { id: 'q2' };
  const srs = {
    q1: { seen: 3, interval: 5, lastReviewed: now - 30 * DAY }, // 経過長い→リスク高い
    q2: { seen: 3, interval: 5, lastReviewed: now - 1 * DAY }, // 経過短い→リスク低い
  };
  const risk = forgettingRisk([q1, q2], srs, { now, threshold: 0 });
  assert.equal(risk[0].id, 'q1');
});

test('dailyForgettingPick: 対象が無ければnull', () => {
  assert.equal(dailyForgettingPick([], {}), null);
});

test('dailyForgettingPick: 同じ日なら同じ1件を返す（安定した日替わり）', () => {
  const now = Date.now();
  const questions = Array.from({ length: 5 }, (_, i) => ({ id: `q${i}` }));
  const srs = Object.fromEntries(questions.map((q, i) => [q.id, { seen: 3, interval: 5, lastReviewed: now - (10 + i) * DAY }]));
  const a = dailyForgettingPick(questions, srs, { now, threshold: 0, topN: 5 });
  const b = dailyForgettingPick(questions, srs, { now: now + 1000, threshold: 0, topN: 5 });
  assert.equal(a.id, b.id);
});
