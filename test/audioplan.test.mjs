import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clustersMap,
  allKeywords,
  relatedKeywordMap,
  chainOrder,
  keywordAccuracy,
} from '../src/lib/audioplan.js';

// テスト用の問題（tags に連結キーワード）
const Q = [
  { id: 'a', subject: '経穴', tags: ['合谷', '原穴', '大腸経'] },
  { id: 'b', subject: '経穴', tags: ['太衝', '原穴', '肝経'] },
  { id: 'c', subject: '生理', tags: ['原穴'] },
  { id: 'd', subject: '解剖', tags: ['大腸経'] },
];
const links = {};

test('clustersMap / allKeywords: キーワードごとに問題が集まる', () => {
  const m = clustersMap(Q, links);
  assert.equal(m.get('原穴').length, 3);
  assert.equal(m.get('大腸経').length, 2);
  const all = allKeywords(Q, links);
  assert.equal(all[0].keyword, '原穴'); // 最多
  assert.equal(all[0].count, 3);
});

test('relatedKeywordMap: 共起で関連キーワードが出る', () => {
  const rel = relatedKeywordMap(Q, links);
  // 合谷は 原穴・大腸経 と同じ問題(a)に居る
  assert.ok(rel.get('合谷').includes('原穴'));
  assert.ok(rel.get('合谷').includes('大腸経'));
  // 原穴は最も多くの語と共起
  assert.ok(rel.get('原穴').length >= 3);
});

test('chainOrder: start から関連をたどり、全キーワードを重複なく並べる', () => {
  const rel = relatedKeywordMap(Q, links);
  const all = allKeywords(Q, links).map((k) => k.keyword);
  const order = chainOrder('合谷', rel, all);
  assert.equal(order[0], '合谷');
  assert.equal(new Set(order).size, order.length); // 重複なし
  assert.equal(order.length, all.length); // 全部入る
  assert.ok(order.includes('肝経'));
});

test('keywordAccuracy: 正答率が低いキーワードが先に来る', () => {
  const history = [
    // 原穴の問題は不正解が多い（弱点）
    { questionId: 'a', correct: false },
    { questionId: 'b', correct: false },
    { questionId: 'c', correct: false },
    // 大腸経(dのみ回答)は正解
    { questionId: 'd', correct: true },
  ];
  const ranked = keywordAccuracy(Q, links, history);
  assert.equal(ranked[0].keyword, '原穴'); // 0% が先頭
  assert.equal(ranked[0].accuracy, 0);
  const daicho = ranked.find((r) => r.keyword === '大腸経');
  assert.ok(daicho.accuracy > 0);
});
