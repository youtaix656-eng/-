import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberTokens, numberSkewers } from '../src/lib/numberLinks.js';
import { conceptGrowth, diseaseTriad } from '../src/lib/kgTimeline.js';
import { emptyGraph, addCoOccurrence } from '../src/lib/knowledgeGraph.js';

test('numberTokens: 数値トークン抽出', () => {
  assert.deepEqual(numberTokens('約50%'), ['50']);
  assert.deepEqual(numberTokens('男81歳/女87歳'), ['81', '87']);
});

test('numberSkewers: 同じ数字を分野横断で束ねる', () => {
  const facts = [
    { id: 'a', subject: '衛生', value: '約50%', topic: 'X' },
    { id: 'b', subject: '臨床', value: '50点', topic: 'Y' },
    { id: 'c', subject: '衛生', value: '30%', topic: 'Z' },
  ];
  const sk = numberSkewers(facts);
  const g50 = sk.find((g) => g.num === '50');
  assert.ok(g50 && g50.facts.length === 2);
  assert.equal(g50.crossSubject, true);
});

test('conceptGrowth: 累積の概念数が増える', () => {
  const now = Date.now();
  const DAY = 86400000;
  const questions = [
    { id: 'q1', tags: ['心不全', '利尿薬'] },
    { id: 'q2', tags: ['心不全', '浮腫'] },
  ];
  const history = [
    { questionId: 'q1', at: now - 1 * DAY },
    { questionId: 'q2', at: now },
  ];
  const g = conceptGrowth(history, questions, {}, { days: 3, now });
  assert.equal(g.length, 3);
  assert.ok(g[g.length - 1].cumulative >= 3); // 心不全・利尿薬・浮腫
});

test('diseaseTriad: 原因・治療・関連を集める', () => {
  // 同梱 relations に 尿酸→痛風(causes) がある
  const graph = emptyGraph();
  addCoOccurrence(graph, ['痛風', '第一中足趾節関節']);
  const t = diseaseTriad('痛風', graph);
  assert.ok(t.causes.includes('尿酸'), '尿酸が原因に');
  assert.ok(Array.isArray(t.related));
});
