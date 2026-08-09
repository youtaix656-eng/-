import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pmiWeights, topAssociations, applyPmiStrength } from '../src/lib/coOccur.js';
import { extractRelations } from '../src/lib/relationExtract.js';
import { buildIndex, similar, cosine } from '../src/lib/simIndex.js';
import { emptyGraph, addCoOccurrence, edgeKey } from '../src/lib/knowledgeGraph.js';

// ---- #4 共起・PMI ----
test('pmiWeights: 強く結びつくペアほど高PMI', () => {
  const docs = [
    ['A', 'B'],
    ['A', 'B'],
    ['A', 'C'], // A は頻出、C は A としか出ない一回きり
    ['C', 'D'],
  ];
  const w = pmiWeights(docs);
  const ab = [...w.values()].find((x) => (x.a === 'A' && x.b === 'B') || (x.a === 'B' && x.b === 'A'));
  const ac = [...w.values()].find((x) => (x.a === 'A' && x.b === 'C') || (x.a === 'C' && x.b === 'A'));
  assert.equal(ab.co, 2);
  assert.ok(ab.pmi > ac.pmi, `AB(${ab.pmi}) > AC(${ac.pmi})`);
});

test('topAssociations: minCo でフィルタし PMI>0 のみ', () => {
  const docs = [['A', 'B'], ['A', 'B'], ['C', 'D']];
  const top = topAssociations(docs, { minCo: 2 });
  assert.equal(top.length, 1);
  assert.equal(top[0].co, 2);
  assert.ok(top[0].pmi > 0);
});

test('applyPmiStrength: グラフのエッジ strength を更新', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['A', 'B']);
  addCoOccurrence(g, ['A', 'B']);
  applyPmiStrength(g, [['A', 'B'], ['A', 'B']]);
  assert.ok(g.edges[edgeKey('A', 'B')].strength >= 0);
});

// ---- #5 関係抽出 ----
test('extractRelations: 手がかり語から型付き関係', () => {
  const r = extractRelations('尿酸により痛風が生じる。', ['尿酸', '痛風']);
  assert.equal(r.length, 1);
  assert.equal(r[0].type, 'causes');
  assert.equal(r[0].from, '尿酸'); // 出現が早い方が from
  assert.equal(r[0].to, '痛風');
});

test('extractRelations: 対比の手がかり', () => {
  const r = extractRelations('痛風と偽痛風を鑑別する。', ['痛風', '偽痛風']);
  assert.equal(r[0].type, 'contrast');
});

test('extractRelations: 手がかりが無ければ空', () => {
  assert.deepEqual(extractRelations('AとBがある。', ['A', 'B']), []);
});

// ---- #6 類似度 ----
test('buildIndex / similar: 概念を共有する問題が近い', () => {
  const qs = [
    { id: 'a', subject: 'S', tags: ['心不全', '利尿薬', '浮腫'] },
    { id: 'b', subject: 'S', tags: ['心不全', '利尿薬'] },
    { id: 'c', subject: 'S', tags: ['骨折', 'ギプス'] },
  ];
  const idx = buildIndex(qs, {});
  const sim = similar(idx, 'a');
  assert.equal(sim[0].id, 'b', 'aに最も近いのはb');
  assert.ok(!sim.find((x) => x.id === 'c'), '無関係なcは出ない');
});
