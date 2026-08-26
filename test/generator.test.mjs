import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateQuestions, generateVariants, GENERATORS } from '../src/lib/generator.js';
import { yuanPoints, meridians } from '../src/data/knowledgeBase.js';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { muPoints, shuPoints, extraMeridianPoints, confusablePoints, meridianNameById } from '../src/data/knowledgeBase.js';

test('生成した問題は必要な項目を備える', () => {
  const qs = generateQuestions({ count: 8 });
  assert.equal(qs.length, 8);
  qs.forEach((q) => {
    assert.ok(q.question && q.question.length > 0);
    assert.ok(Array.isArray(q.choices) && q.choices.length >= 2);
    assert.ok(q.answer >= 0 && q.answer < q.choices.length);
    assert.equal(q.generated, true);
  });
});

test('生成問題の選択肢に重複がない', () => {
  const qs = generateQuestions({ count: 20 });
  qs.forEach((q) => {
    const set = new Set(q.choices);
    assert.equal(set.size, q.choices.length, `重複あり: ${q.question}`);
  });
});

test('経絡→原穴の生成は KB と正解が一致する', () => {
  // meridianToYuan だけを大量生成し、正解がKBの原穴と一致することを確認
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.meridianToYuan.fn();
    const m = meridians.find((x) => q.question.includes(x.name));
    assert.ok(m, '経絡名が設問に含まれる');
    assert.equal(q.choices[q.answer], yuanPoints[m.id]);
  }
});

test('相生の生成は正しい（木→火 など）', () => {
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.sheng.fn();
    const map = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
    const a = q.question.match(/「(.)」/)[1];
    assert.equal(q.choices[q.answer], map[a]);
  }
});

test('相剋の生成は正しい（木→土 など）', () => {
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.ke.fn();
    const map = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
    const a = q.question.match(/「(.)」/)[1];
    assert.equal(q.choices[q.answer], map[a]);
  }
});

test('指定タイプのみ生成される', () => {
  const qs = generateQuestions({ types: ['sheng'], count: 5 });
  qs.forEach((q) => assert.ok(q.tags.includes('相生')));
});

test('経穴カード→経絡の生成はkeiketsuCards.jsと正解が一致する', () => {
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.keiketsuMeridian.fn();
    assert.ok(q, 'カードが4枚以上あるので必ず生成される');
    const c = KEIKETSU_CARDS.find((x) => q.question.includes(x.name));
    assert.ok(c, '経穴名が設問に含まれる');
    assert.equal(q.choices[q.answer], c.meridian);
    assert.equal(new Set(q.choices).size, q.choices.length);
  }
});

test('経穴カード→取穴部位の生成はkeiketsuCards.jsと正解が一致する', () => {
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.keiketsuLocation.fn();
    assert.ok(q);
    const c = KEIKETSU_CARDS.find((x) => q.question.includes(x.name));
    assert.ok(c, '経穴名が設問に含まれる');
    assert.equal(q.choices[q.answer], c.location);
    assert.equal(new Set(q.choices).size, q.choices.length);
  }
});

test('keiketsuCards.jsの全カードにsourceIds配列がある', () => {
  KEIKETSU_CARDS.forEach((c) => {
    assert.ok(Array.isArray(c.sourceIds), `${c.name} に sourceIds が無い`);
  });
});

test('経絡→募穴の生成はknowledgeBase.jsと正解が一致し、選択肢に重複がない', () => {
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.meridianToMu.fn();
    assert.ok(q);
    const entry = Object.entries(muPoints).find(([, p]) => q.choices[q.answer] === p);
    assert.ok(entry, '正解の募穴がmuPointsに存在する');
    assert.equal(new Set(q.choices).size, q.choices.length);
  }
});

test('経絡→背部兪穴の生成はknowledgeBase.jsと正解が一致し、選択肢に重複がない', () => {
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.meridianToShu.fn();
    assert.ok(q);
    const entry = Object.entries(shuPoints).find(([, p]) => q.choices[q.answer] === p);
    assert.ok(entry, '正解の兪穴がshuPointsに存在する');
    assert.equal(new Set(q.choices).size, q.choices.length);
  }
});

test('紛らわしい経穴の鑑別は、正解と誤答が異なる経絡になり選択肢が重複しない', () => {
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.confusablePoint.fn();
    assert.ok(q);
    assert.equal(new Set(q.choices).size, q.choices.length);
    // 正解の経絡名は選択肢の中で1つだけ
    assert.equal(q.choices.filter((c) => c === q.choices[q.answer]).length, 1);
  }
});

test('奇経八脈の所属穴数の生成はknowledgeBase.jsと正解が一致し、選択肢に重複がない', () => {
  for (let i = 0; i < 30; i++) {
    const q = GENERATORS.extraMeridianCount.fn();
    assert.ok(q);
    const e = extraMeridianPoints.find((x) => q.question.includes(x.name));
    assert.ok(e, '奇経名が設問に含まれる');
    assert.equal(q.choices[q.answer], String(e.count));
    assert.equal(new Set(q.choices).size, q.choices.length);
  }
});

test('knowledgeBase.js: muPoints/shuPointsは12経すべてを網羅し値が重複しない', () => {
  const meridianIds = ['LU', 'LI', 'ST', 'SP', 'HT', 'SI', 'BL', 'KI', 'PC', 'TE', 'GB', 'LR'];
  for (const id of meridianIds) {
    assert.ok(muPoints[id], `muPointsに${id}が無い`);
    assert.ok(shuPoints[id], `shuPointsに${id}が無い`);
  }
  assert.equal(new Set(Object.values(muPoints)).size, meridianIds.length);
  assert.equal(new Set(Object.values(shuPoints)).size, meridianIds.length);
});

test('knowledgeBase.js: extraMeridianPointsは6奇経すべてを持つ', () => {
  const ids = extraMeridianPoints.map((e) => e.id);
  assert.deepEqual(ids.sort(), ['chong', 'dai', 'yangqiao', 'yangwei', 'yinqiao', 'yinwei'].sort());
  extraMeridianPoints.forEach((e) => {
    assert.ok(e.name && e.points && typeof e.count === 'number');
  });
});

test('knowledgeBase.js: confusablePointsは全件が異なる経絡ID・名称の組で、meridianNameByIdで解決できる', () => {
  // 教科書p.239の同経同字2組+異経同字4組+同音異字17組。ただし同音異字のうち2組は
  // 3穴セット（少海/小海/照海、承漿/少商/少衝）のためペアに分解すると19組になり、
  // 合計は 2+4+19=25 組。
  assert.equal(confusablePoints.length, 25);
  confusablePoints.forEach((c) => {
    assert.ok(c.a && c.b && c.a !== c.b);
    assert.ok(meridianNameById(c.aMeridian));
    assert.ok(meridianNameById(c.bMeridian));
  });
});

test('meridianNameById: GV/CVを含む正しい名称を返す', () => {
  assert.equal(meridianNameById('GV'), '督脈');
  assert.equal(meridianNameById('CV'), '任脈');
  assert.equal(meridianNameById('LU'), '手の太陰肺経');
  assert.equal(meridianNameById('xx'), 'xx');
});

test('○×変形は正誤が整合する', () => {
  const base = {
    id: 'b1',
    subject: 'テスト',
    type: 'choice',
    question: '合谷が属する経絡はどれか。',
    choices: ['手の陽明大腸経', '手の太陰肺経', '手の少陰心経', '手の厥陰心包経'],
    answer: 0,
    explanation: '合谷は大腸経。',
  };
  const vs = generateVariants([base], { perQuestion: 2 });
  assert.ok(vs.length >= 1);
  vs.forEach((v) => {
    assert.equal(v.type, 'ox');
    assert.ok(v.answer === 0 || v.answer === 1);
    assert.equal(v.choices.length, 2);
  });
});
