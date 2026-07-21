import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFromNotes } from '../src/lib/notegen.js';

// 決定的にするため固定 rng を渡す
const fixedRng = () => 0.42;

test('説明文から穴埋め四択を生成し、正解が選択肢に含まれる', () => {
  const text = [
    '合谷は手の陽明大腸経の原穴である。',
    '太衝は足の厥陰肝経の原穴である。',
    '太淵は手の太陰肺経の原穴である。',
    '神門は手の少陰心経の原穴である。',
  ].join('\n');
  const { questions } = generateFromNotes(text, { rng: fixedRng, choiceCount: 4 });
  assert.ok(questions.length >= 3, `生成数が少ない: ${questions.length}`);
  for (const q of questions) {
    assert.equal(q.type, 'choice');
    assert.ok(q.question.includes('（　　　）'), '空欄が入っていない');
    assert.ok(q.choices.length >= 2);
    // 正解インデックスが範囲内で、選択肢が答えを含む
    assert.ok(q.answer >= 0 && q.answer < q.choices.length);
    assert.ok(q.choices[q.answer], '正解の選択肢が空');
    // 元の文が解説に入る
    assert.ok(q.explanation.startsWith('元の文：'));
  }
});

test('選択肢の重複が無い（正解＋ダミー）', () => {
  const text = [
    '肝は木に属し、心は火に属する。',
    '脾は土に属し、肺は金に属する。',
    '腎は水に属する五臓のひとつである。',
  ].join('\n');
  const { questions } = generateFromNotes(text, { rng: fixedRng });
  for (const q of questions) {
    const set = new Set(q.choices);
    assert.equal(set.size, q.choices.length, `選択肢が重複: ${q.choices}`);
  }
});

test('choiceCount を指定できる（最大でその数）', () => {
  const text = [
    'アルファは第一の用語である。',
    'ベータは第二の用語である。',
    'ガンマは第三の用語である。',
    'デルタは第四の用語である。',
    'イプシロンは第五の用語である。',
  ].join('\n');
  const { questions } = generateFromNotes(text, { rng: fixedRng, choiceCount: 3 });
  assert.ok(questions.length > 0);
  for (const q of questions) {
    assert.ok(q.choices.length <= 3);
  }
});

test('空文字は警告つきで空配列', () => {
  const { questions, warnings } = generateFromNotes('   ', { rng: fixedRng });
  assert.equal(questions.length, 0);
  assert.ok(warnings.length > 0);
});

test('用語が乏しい文章では生成できない旨を返す', () => {
  const { questions, warnings } = generateFromNotes('あ。い。う。', { rng: fixedRng });
  assert.equal(questions.length, 0);
  assert.ok(warnings.some((w) => w.includes('見つかりません') || w.includes('生成できません')));
});

test('max で生成数の上限を制御', () => {
  const lines = [];
  for (let i = 0; i < 20; i++) lines.push(`用語${i}番は重要な項目であり試験に出る。`);
  const { questions } = generateFromNotes(lines.join('\n'), { rng: fixedRng, max: 5 });
  assert.ok(questions.length <= 5);
});
