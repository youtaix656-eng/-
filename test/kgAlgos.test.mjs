import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortestPath, pathRelations } from '../src/lib/graphAlgos.js';
import { recallPairs, chainNext, elaborationSuggestions } from '../src/lib/kgRecall.js';
import { emptyGraph, addCoOccurrence } from '../src/lib/knowledgeGraph.js';

test('shortestPath: 2ホップの経路を返す', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['心不全', '利尿薬']);
  addCoOccurrence(g, ['利尿薬', '低カリウム血症']);
  const path = shortestPath(g, '心不全', '低カリウム血症');
  assert.deepEqual(path, ['心不全', '利尿薬', '低カリウム血症']);
  assert.equal(pathRelations(g, path).length, 2);
});

test('shortestPath: 同一/到達不可', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['A', 'B']);
  addCoOccurrence(g, ['C', 'D']);
  assert.deepEqual(shortestPath(g, 'A', 'A'), ['A']);
  assert.equal(shortestPath(g, 'A', 'C'), null);
});

test('recallPairs: 強い順に想起ペアを返す', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['A', 'B']);
  g.edges[Object.keys(g.edges)[0]].strength = 5;
  const rp = recallPairs(g);
  assert.equal(rp[0].a === 'A' || rp[0].b === 'A', true);
  assert.ok(rp[0].strength >= 5);
});

test('chainNext: 概念を共有する次の1問', () => {
  const cur = { id: 'a', tags: ['心不全', '利尿薬'] };
  const qs = [
    cur,
    { id: 'b', tags: ['心不全', '浮腫'] }, // 共有1
    { id: 'c', tags: ['骨折'] }, // 共有0
  ];
  const next = chainNext(cur, qs, {}, new Set(['a']));
  assert.equal(next.question.id, 'b');
  assert.equal(chainNext(cur, qs, {}, new Set(['a', 'b'])), null); // b除外→なし
});

test('elaborationSuggestions: 隣接する未付与の概念を提案', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['心不全', '利尿薬']);
  addCoOccurrence(g, ['心不全', 'BNP']);
  const sug = elaborationSuggestions(g, ['心不全']);
  assert.ok(sug.includes('利尿薬') && sug.includes('BNP'));
});
