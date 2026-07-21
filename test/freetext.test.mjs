import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFreeText, markerToIndex } from '../src/lib/freetext.js';
import { importCsv, dedupeAgainst } from '../src/lib/importer.js';

test('markerToIndex: 数字/丸数字/カナ/記号付き', () => {
  assert.equal(markerToIndex('3'), 2);
  assert.equal(markerToIndex('3.'), 2);
  assert.equal(markerToIndex('③'), 2);
  assert.equal(markerToIndex('ウ'), 2);
  assert.equal(markerToIndex('(4)'), 3);
  assert.equal(markerToIndex('x'), -1);
});

test('自由文: 問N＋番号選択肢＋正解を解析', () => {
  const t = `問1 合谷が属する経絡はどれか。\n1. 手の陽明大腸経\n2. 手の太陰肺経\n3. 手の少陰心経\n4. 手の厥陰心包経\n正解 1\n解説 合谷は大腸経の原穴。`;
  const { questions } = parseFreeText(t);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].choices.length, 4);
  assert.equal(questions[0].answer, 0);
  assert.ok(questions[0].question.includes('合谷'));
  assert.ok(questions[0].explanation.includes('大腸経'));
});

test('自由文: スペース区切り選択肢と丸数字正解', () => {
  const t = `Q1 五行で木が剋すのは。\n1 火\n2 土\n3 金\n4 水\n答え：②`;
  const { questions } = parseFreeText(t);
  assert.equal(questions[0].choices.length, 4);
  assert.equal(questions[0].answer, 1);
});

test('自由文: 正解が無ければ needsAnswer フラグ', () => {
  const t = `問1 説明せよ。\n1. あ\n2. い`;
  const { questions, warnings } = parseFreeText(t);
  assert.equal(questions[0]._needsAnswer, true);
  assert.ok(warnings.length > 0);
});

test('自由文: ヘッダ無しでも選択肢リセットで分割', () => {
  const t = `最初の問題。\n1 A\n2 B\n3 C\n4 D\n次の問題。\n1 E\n2 F\n3 G\n4 H`;
  const { questions } = parseFreeText(t);
  assert.equal(questions.length, 2);
});

test('TSV（タブ区切り）の貼り付けを取り込める', () => {
  const tsv = '科目\t問題文\t選択肢\t正解\t解説\n生理\tQ1\tあ|い|う|え\t2\t解説';
  const { questions, errors } = importCsv(tsv);
  assert.equal(errors.length, 0);
  assert.equal(questions[0].subject, '生理');
  assert.equal(questions[0].answer, 1);
});

test('dedupeAgainst: 既存・自身の重複を除く', () => {
  const existing = [{ question: '合谷が属する経絡はどれか。' }];
  const incoming = [
    { id: 'a', question: '合谷が属する経絡はどれか。' }, // 既存重複
    { id: 'b', question: '新しい問題X' },
    { id: 'c', question: '新しい問題X' }, // 自身内重複
  ];
  const { unique, duplicates } = dedupeAgainst(incoming, existing);
  assert.equal(unique.length, 1);
  assert.equal(unique[0].id, 'b');
  assert.equal(duplicates.length, 2);
});
