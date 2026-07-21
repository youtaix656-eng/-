import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTermDict,
  suggestKeywords,
  relatedQuestions,
  isolatedReport,
  keywordHeat,
  heatColor,
  graphData,
  circleLayout,
  buildConnectQuiz,
} from '../src/lib/connectlab.js';

const Q = [
  { id: 'a', subject: '経穴', question: '合谷が属する経絡はどれか。', choices: ['大腸経'], answer: 0, tags: ['合谷', '原穴', '大腸経'] },
  { id: 'b', subject: '経穴', question: '太衝は肝経の原穴である。', choices: [], answer: 0, tags: ['太衝', '原穴', '肝経'] },
  { id: 'c', subject: '生理', question: '原穴の説明として正しいものは。', choices: ['A'], answer: 0, tags: ['原穴'] },
  { id: 'd', subject: '解剖', question: '大腸経の走行について。', choices: ['B'], answer: 0, tags: ['大腸経'] },
  { id: 'e', subject: '生理', question: 'キーワードのない問題。', choices: ['C'], answer: 0 },
];
const links = {};

test('buildTermDict / suggestKeywords: 本文から標準用語を拾う', () => {
  const dict = buildTermDict();
  assert.ok(dict.has('原穴'));
  assert.ok(dict.has('合谷'));
  const sug = suggestKeywords('合谷は大腸経の原穴である。', ['合谷'], dict);
  assert.ok(sug.includes('原穴'));
  assert.ok(sug.includes('大腸経'));
  assert.ok(!sug.includes('合谷')); // 既存は除外
});

test('relatedQuestions: 共有キーワードが多い問題を上位に', () => {
  const rel = relatedQuestions(Q[0], Q, links, { limit: 5 });
  // b（原穴を共有）や d（大腸経を共有）が入る
  const ids = rel.map((r) => r.q.id);
  assert.ok(ids.includes('b') || ids.includes('d'));
  // キーワード無しの e は関連しない
  assert.ok(!ids.includes('e'));
  assert.ok(rel[0].reason.length > 0);
});

test('isolatedReport: キーワード無し問題と1問だけの語を検出', () => {
  const rep = isolatedReport(Q, links);
  assert.equal(rep.untaggedCount, 1); // e
  assert.equal(rep.untagged[0].id, 'e');
  // 合谷/太衝/肝経 は1問だけ
  const singleKws = rep.singletons.map((s) => s.keyword);
  assert.ok(singleKws.includes('合谷'));
  assert.ok(singleKws.includes('肝経'));
  assert.ok(!singleKws.includes('原穴')); // 3問ある
});

test('keywordHeat / heatColor: 正答率で色が変わる', () => {
  const history = [
    { questionId: 'a', correct: false },
    { questionId: 'c', correct: false },
  ];
  const heat = keywordHeat(Q, links, history);
  const genketsu = heat.find((h) => h.keyword === '原穴');
  assert.ok(genketsu.accuracy < 0.5);
  assert.equal(heatColor(0.2), '#e26a5e'); // 苦手=赤
  assert.equal(heatColor(0.9), '#3aa878'); // 得意=緑
  assert.equal(heatColor(null), '#5b6b7c'); // 未回答=グレー
});

test('graphData / circleLayout: ノードとエッジ、座標が付く', () => {
  const g = graphData(Q, links, []);
  assert.ok(g.nodes.length >= 4);
  // 原穴 と 大腸経 は問題aで共起 → エッジがある
  const hasEdge = g.edges.some(
    (e) => (e.source === '原穴' && e.target === '大腸経') || (e.source === '大腸経' && e.target === '原穴')
  );
  assert.ok(hasEdge);
  const laid = circleLayout(g.nodes);
  assert.ok(laid.every((n) => typeof n.x === 'number' && typeof n.y === 'number'));
});

test('buildConnectQuiz: 共通キーワード当て/仲間はずれを作る（正解が範囲内）', () => {
  const rng = () => 0.5;
  const items = buildConnectQuiz(Q, links, { rng, max: 6 });
  assert.ok(items.length > 0);
  for (const it of items) {
    assert.ok(['common', 'odd'].includes(it.type));
    assert.ok(it.answer >= 0 && it.answer < it.options.length);
    assert.ok(it.options[it.answer]);
  }
});
