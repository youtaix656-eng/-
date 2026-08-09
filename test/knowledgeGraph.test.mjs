import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyGraph, addNode, addEdge, addCoOccurrence, neighbors, edgeKey, graphStats } from '../src/lib/knowledgeGraph.js';
import { conceptId, conceptsOf } from '../src/lib/concepts.js';
import { validateRelation, validateRelations, isRelationType } from '../src/lib/relations.js';
import authoredRelations from '../src/data/relations.js';

test('conceptId: 表記ゆれを正式名称へ', () => {
  assert.equal(conceptId('ACL'), '前十字靱帯');
  assert.equal(conceptId('頚部'), '頸部');
});

test('conceptsOf: 正規化・汎用語除外・重複排除', () => {
  const q = { tags: ['ACL', '前十字靱帯', '症状', 'x'] };
  const cs = conceptsOf(q, {});
  assert.deepEqual(cs, ['前十字靱帯']); // ACLと前十字靱帯が統合、症状=汎用除外、x=1文字除外
});

test('addCoOccurrence: ノードと全ペアのエッジを作る', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['心不全', '利尿薬', '浮腫'], { subject: '循環器' });
  assert.equal(graphStats(g).nodes, 3);
  assert.equal(graphStats(g).edges, 3); // 3C2
  assert.equal(g.nodes['心不全'].subjects[0], '循環器');
});

test('addEdge: 重み・共起回数が加算される', () => {
  const g = emptyGraph();
  addEdge(g, 'a', 'b');
  addEdge(g, 'b', 'a'); // 無向なので同じエッジ
  const e = g.edges[edgeKey('a', 'b')];
  assert.equal(e.co, 2);
  assert.equal(e.weight, 2);
  assert.equal(graphStats(g).edges, 1);
});

test('neighbors: 隣接ノードを返す', () => {
  const g = emptyGraph();
  addCoOccurrence(g, ['A', 'B', 'C']);
  const nb = neighbors(g, 'A').map((n) => n.other).sort();
  assert.deepEqual(nb, ['B', 'C']);
});

test('関係スキーマ: 検証', () => {
  assert.deepEqual(validateRelation({ from: '痛風', to: '偽痛風', type: 'contrast' }), []);
  assert.ok(validateRelation({ from: 'a', to: 'a', type: 'contrast' }).some((e) => e.includes('同一')));
  assert.ok(validateRelation({ from: 'a', to: 'b', type: 'unknown' }).some((e) => e.includes('type')));
  assert.equal(isRelationType('causes'), true);
});

test('同梱の関係データは全て妥当', () => {
  const rep = validateRelations(authoredRelations);
  assert.equal(rep.ok, true, JSON.stringify(rep.bad));
  assert.ok(rep.total >= 10);
});
