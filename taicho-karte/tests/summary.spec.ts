import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestSymptoms, linkableSymptoms, recentSummary } from '../src/lib/summary.js';
import { care, DAY, NOW, symptom } from './fixtures.js';

const symptoms = [
  symptom({ id: 'a', at: NOW - 10 * DAY, regionId: 'lower_back', vas: 8 }),
  symptom({ id: 'b', at: NOW - 2 * DAY, regionId: 'lower_back', vas: 2 }),
  symptom({ id: 'c', at: NOW - 2 * DAY + 3600000, regionId: 'knee_r', vas: 6 }),
  symptom({ id: 'd', at: NOW - 1 * DAY, regionId: 'lower_back', vas: 4 }),
  symptom({ id: 'future', at: NOW + DAY, regionId: 'head', vas: 1 }),
];
const cares = [
  care({ id: 'k1', at: NOW - 1 * DAY, effect: 'better' }),
  care({ id: 'k2', at: NOW - 20 * DAY, effect: 'much_better' }),
  care({ id: 'k3', at: NOW - 3 * DAY, effect: 'worse' }),
];

test('直近7日：件数・記録した日数・部位別・VASの幅（平均は出さない）', () => {
  const s = recentSummary(symptoms, cares, 7, NOW);
  assert.equal(s.symptomCount, 3);
  assert.equal(s.recordedDays, 2);
  assert.deepEqual(s.byRegion, [
    { regionId: 'lower_back', count: 2 },
    { regionId: 'knee_r', count: 1 },
  ]);
  assert.deepEqual(s.vasRange, { min: 2, max: 6 });
  assert.equal(s.careCount, 2);
  assert.equal(s.helpedCount, 1);
  assert.equal('average' in s, false);
});

test('直近30日は古い記録も入る・未来の記録は入れない', () => {
  const s = recentSummary(symptoms, cares, 30, NOW);
  assert.equal(s.symptomCount, 4);
  assert.equal(s.helpedCount, 2);
});

test('記録が無ければ VAS の幅は null', () => {
  const s = recentSummary([], [], 7, NOW);
  assert.equal(s.vasRange, null);
  assert.deepEqual(s.byRegion, []);
});

test('最近の症状は新しい順に n 件', () => {
  assert.deepEqual(latestSymptoms(symptoms, 2).map((s) => s.id), ['future', 'd']);
});

test('紐づけ候補は直近30日を新しい順に', () => {
  assert.deepEqual(linkableSymptoms(symptoms, NOW).map((s) => s.id), ['future', 'd', 'c', 'b', 'a']);
  assert.deepEqual(linkableSymptoms(symptoms, NOW, 5).map((s) => s.id), ['future', 'd', 'c', 'b']);
});
