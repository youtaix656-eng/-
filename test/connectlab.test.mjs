import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTermDict,
  suggestKeywords,
  bulkAutoTagPlan,
  synonymGroups,
  detectVariantPairs,
  isolatedReport,
  keywordHeat,
  heatColor,
  buildConnectQuiz,
} from '../src/lib/connectlab.js';

const Q = [
  { id: 'a', subject: '経穴', question: '合谷が属する経絡はどれか。', choices: ['大腸経'], answer: 0, tags: ['合谷', '原穴', '大腸経'] },
  { id: 'b', subject: '経穴', question: '太衝は肝経の原穴である。', choices: [], answer: 0, tags: ['太衝', '原穴', '肝経'] },
  { id: 'c', subject: '生理', question: '交感神経の作用として正しいものは。', choices: ['A'], answer: 0, tags: ['原穴'] },
  { id: 'd', subject: '解剖', question: '大腸経の走行について。', choices: ['B'], answer: 0, tags: ['大腸経'] },
  { id: 'e', subject: '病理', question: '炎症の四徴に含まれないものはどれか。', choices: ['C'], answer: 0 },
];
const links = {};

test('buildTermDict / suggestKeywords: KB＋全科目用語＋ユーザー辞書', () => {
  const dict = buildTermDict(['自作用語']);
  assert.ok(dict.has('原穴'));
  assert.ok(dict.has('交感神経')); // 生理
  assert.ok(dict.has('炎症')); // 病理
  assert.ok(dict.has('自作用語')); // ユーザー辞書
  const sug = suggestKeywords('交感神経と副交感神経の炎症', [], dict);
  assert.ok(sug.includes('交感神経'));
  assert.ok(sug.includes('炎症'));
});

test('bulkAutoTagPlan: キーワード無しの問題に候補を提案', () => {
  const plan = bulkAutoTagPlan(Q, links, { onlyUntagged: true, perQuestion: 2 });
  // e（キーワード無し・炎症を含む）が対象
  const forE = plan.find((p) => p.id === 'e');
  assert.ok(forE, 'e にプランがある');
  assert.ok(forE.add.includes('炎症'));
  // 既にタグのある a は対象外
  assert.ok(!plan.find((p) => p.id === 'a'));
});

test('synonymGroups / detectVariantPairs: 経絡の表記ゆれを検出', () => {
  const groups = synonymGroups();
  assert.ok(groups.some((g) => g.variants.includes('大腸経') && g.variants.includes('手の陽明大腸経')));
  const pairs = detectVariantPairs(['大腸経', '手の陽明大腸経', '原穴']);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].canonical, '大腸経');
  assert.equal(pairs[0].variants.length, 2);
});

test('isolatedReport: キーワード無し問題と1問だけの語を検出', () => {
  const rep = isolatedReport(Q, links);
  assert.equal(rep.untaggedCount, 1);
  assert.equal(rep.untagged[0].id, 'e');
  const single = rep.singletons.map((s) => s.keyword);
  assert.ok(single.includes('合谷'));
  assert.ok(!single.includes('原穴')); // 3問
});

test('keywordHeat / heatColor', () => {
  const history = [{ questionId: 'a', correct: false }, { questionId: 'c', correct: false }];
  const heat = keywordHeat(Q, links, history);
  assert.ok(heat.find((h) => h.keyword === '原穴').accuracy < 0.5);
  assert.equal(heatColor(0.2), '#e26a5e');
  assert.equal(heatColor(0.9), '#3aa878');
  assert.equal(heatColor(null), '#5b6b7c');
});

test('buildConnectQuiz: 復習連動用の qids を含み、正解が範囲内', () => {
  const rng = () => 0.5;
  const items = buildConnectQuiz(Q, links, { rng, max: 6 });
  assert.ok(items.length > 0);
  for (const it of items) {
    assert.ok(['common', 'odd'].includes(it.type));
    assert.ok(it.answer >= 0 && it.answer < it.options.length);
    assert.ok(Array.isArray(it.qids) && it.qids.length > 0);
  }
});
