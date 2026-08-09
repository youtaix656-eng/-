import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reinforceEdge, effectiveStrength, spreadingActivation, rankByActivation } from '../src/lib/assocStrength.js';
import { scheduleEdge, isEdgeDue, dueAssociations, emptyEdgeSrs } from '../src/lib/edgeSrs.js';
import { nodeDegrees, isolatedConcepts, conceptMasteryMap, connectionSuggestions } from '../src/lib/learnerModel.js';
import { emptyGraph, addCoOccurrence, addNode } from '../src/lib/knowledgeGraph.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

// ---- #7 連想強度 ----
test('reinforceEdge: 正解で強化・不正解で減衰', () => {
  const e = { strength: 1 };
  reinforceEdge(e, true, NOW);
  assert.ok(e.strength > 1);
  const s1 = e.strength;
  reinforceEdge(e, false, NOW);
  assert.ok(e.strength < s1);
});

test('effectiveStrength: 時間で半減', () => {
  const e = { strength: 4, lastReinforced: NOW - 30 * DAY };
  const eff = effectiveStrength(e, NOW, { halfLifeDays: 30 });
  assert.ok(Math.abs(eff - 2) < 0.01, `半減期30日で約2 (${eff})`);
});

test('spreadingActivation: seedから隣接概念へ活性が伝わる', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['心不全', '利尿薬']);
  addCoOccurrence(g, ['利尿薬', '低カリウム血症']);
  const act = spreadingActivation(g, ['心不全'], { maxDepth: 2, now: NOW });
  assert.ok(act.get('利尿薬') > 0, '隣接が活性化');
  assert.ok(act.has('低カリウム血症'), '2ホップ先も活性化');
  const rank = rankByActivation(act, ['心不全']);
  assert.equal(rank[0].id, '利尿薬');
});

// ---- #8 辺のSRS ----
test('scheduleEdge: 正解でボックスが進み due が延びる', () => {
  let s = emptyEdgeSrs();
  s = scheduleEdge(s, true, NOW);
  assert.equal(s.box, 1);
  s = scheduleEdge(s, true, NOW);
  assert.equal(s.box, 2);
  assert.ok(s.due > NOW);
  const failed = scheduleEdge(s, false, NOW);
  assert.equal(failed.box, 1, '失敗で最初へ戻る');
});

test('dueAssociations: 期限切れの連結を返す', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['A', 'B']);
  addCoOccurrence(g, ['C', 'D']);
  // A-B は未来、C-D は期限切れ
  Object.values(g.edges)[0].srs = { box: 2, due: NOW + DAY };
  Object.values(g.edges)[1].srs = { box: 1, due: NOW - DAY };
  const due = dueAssociations(g, NOW);
  assert.equal(due.length, 1);
  assert.ok(isEdgeDue(undefined, NOW), '未スケジュールは対象');
});

// ---- #9 学習者モデル ----
test('isolatedConcepts: つながりの無い概念を検出', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['A', 'B']); // A,B は次数1
  addNode(g, '孤立'); // 次数0
  const iso = isolatedConcepts(g, { maxDegree: 0 });
  assert.deepEqual(iso.map((x) => x.id), ['孤立']);
  const deg = nodeDegrees(g);
  assert.equal(deg.get('A'), 1);
});

test('conceptMasteryMap / connectionSuggestions', () => {
  const qs = [
    { id: 'a', tags: ['心不全', '利尿薬'] },
    { id: 'b', tags: ['孤立概念'] },
  ];
  const srs = { a: { correctStreak: 5, interval: 60, ef: 2.5 }, b: {} };
  const mm = conceptMasteryMap(qs, srs, {});
  assert.ok(mm.get('心不全').ratio >= 0);
  const g = emptyGraph();
  addCoOccurrence(g, ['心不全', '利尿薬']);
  addNode(g, '孤立概念');
  const sug = connectionSuggestions(g, qs, srs, {});
  assert.ok(sug.find((s) => s.id === '孤立概念'), '孤立概念が提案に出る');
});
