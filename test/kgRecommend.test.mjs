import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendNext } from '../src/lib/kgRecommend.js';
import { buildGraphFromSolved, todaysLinks } from '../src/lib/kgService.js';
import { graphStats } from '../src/lib/knowledgeGraph.js';

test('buildGraphFromSolved: 共起＋作者関係でグラフ構築', () => {
  const solved = [
    { id: 'a', subject: '運動器', tags: ['痛風', '尿酸', '第一中足趾節関節'] },
    { id: 'b', subject: '運動器', tags: ['偽痛風', 'ピロリン酸カルシウム', '膝関節'] },
  ];
  const g = buildGraphFromSolved(solved, {});
  assert.ok(graphStats(g).nodes >= 6);
  // 作者関係 痛風-尿酸(causes) など両端が在るので辺が増えている
  assert.ok(graphStats(g).edges >= 6);
});

test('recommendNext: 既知に橋渡ししつつ新概念を足す問題を推薦', () => {
  const solved = [{ id: 'a', tags: ['心不全', '利尿薬'] }];
  const g = buildGraphFromSolved(solved, {});
  const all = [
    { id: 'a', tags: ['心不全', '利尿薬'] },
    { id: 'b', tags: ['心不全', '低カリウム血症'] }, // 既知(心不全)+新(低K) → 推薦
    { id: 'c', tags: ['全く別1', '全く別2'] }, // 既知なし → 除外
  ];
  const rec = recommendNext(g, all, new Set(['a']), {});
  assert.equal(rec[0].id, 'b');
  assert.ok(rec[0].bridges.includes('心不全'));
  assert.ok(rec[0].adds.includes('低カリウム血症'));
  assert.ok(!rec.find((r) => r.id === 'c'));
});

test('todaysLinks: 今日の問題の概念ペアを返す', () => {
  const today = [{ id: 'a', tags: ['心不全', '利尿薬', '浮腫'] }];
  const links = todaysLinks(today, {});
  assert.equal(links.length, 3); // 3C2
});
