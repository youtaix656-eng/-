import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateLevel, LEVELS } from '../src/lib/learnerLevel.js';

test('estimateLevel: 触れた問題数が少なければ初級者', () => {
  const srs = { 'q-1': { correctStreak: 1 }, 'q-2': { correctStreak: 0 } };
  const out = estimateLevel({ srs, history: [] });
  assert.equal(out.id, LEVELS.beginner.id);
});

test('estimateLevel: 触れた数が多くマスターが少なければ中級者', () => {
  const srs = {};
  for (let i = 0; i < 200; i++) srs[`q-${i}`] = { correctStreak: 1 };
  const out = estimateLevel({ srs, history: [] });
  assert.equal(out.id, LEVELS.intermediate.id);
});

test('estimateLevel: マスター数が十分多ければ上級者', () => {
  const srs = {};
  for (let i = 0; i < 600; i++) srs[`q-${i}`] = { correctStreak: 5 }; // MASTER_STREAK=5
  const out = estimateLevel({ srs, history: [] });
  assert.equal(out.id, LEVELS.advanced.id);
});

test('estimateLevel: 触れた数が多く直近正答率が高ければ上級者', () => {
  const srs = {};
  for (let i = 0; i < 900; i++) srs[`q-${i}`] = { correctStreak: 1 };
  const history = Array.from({ length: 120 }, (_, i) => ({ questionId: `q-${i}`, correct: i % 5 !== 0, at: i }));
  const out = estimateLevel({ srs, history });
  assert.equal(out.id, LEVELS.advanced.id);
});

test('estimateLevel: srs/historyが空でも落ちない', () => {
  const out = estimateLevel({});
  assert.equal(out.id, LEVELS.beginner.id);
  assert.equal(out.touchedCount, 0);
});
