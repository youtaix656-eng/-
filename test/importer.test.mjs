import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importCsv, importJson, exportCsv } from '../src/lib/importer.js';

test('CSV: 四択の番号指定を index に変換する', () => {
  const csv = `科目,問題文,選択肢,正解,解説
生理学,問1,あ|い|う|え,3,解説1`;
  const { questions, errors } = importCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].type, 'choice');
  assert.equal(questions[0].answer, 2); // 3番 → index 2
});

test('CSV: 選択肢が空欄なら ○× 問題になる', () => {
  const csv = `科目,問題文,選択肢,正解,解説
東洋,問2,,×,解説2`;
  const { questions } = importCsv(csv);
  assert.equal(questions[0].type, 'ox');
  assert.equal(questions[0].answer, 1); // × → 1
  assert.deepEqual(questions[0].choices, ['○（正しい）', '×（誤り）']);
});

test('CSV: ア/イ/ウ/エ 表記の正解を解釈する', () => {
  const csv = `科目,問題文,選択肢,正解,解説
解剖,問3,あ|い|う|え,イ,解説3`;
  const { questions } = importCsv(csv);
  assert.equal(questions[0].answer, 1); // イ → index 1
});

test('バリデーション: 正解番号が範囲外なら警告し1番目にフォールバック', () => {
  const csv = `科目,問題文,選択肢,正解,解説
生理,問4,あ|い|う|え,9,解説4`;
  const { questions, warnings } = importCsv(csv);
  assert.equal(questions[0].answer, 0);
  assert.ok(warnings.some((w) => w.includes('範囲外')));
});

test('バリデーション: 正解が選択肢と一致しないと警告', () => {
  const csv = `科目,問題文,選択肢,正解,解説
生理,問5,あ|い|う|え,存在しない,解説5`;
  const { warnings } = importCsv(csv);
  assert.ok(warnings.some((w) => w.includes('一致しません')));
});

test('バリデーション: 解説が空だと警告', () => {
  const csv = `科目,問題文,選択肢,正解,解説
生理,問6,あ|い|う|え,1,`;
  const { warnings } = importCsv(csv);
  assert.ok(warnings.some((w) => w.includes('解説が空')));
});

test('バリデーション: ID 重複を検出', () => {
  const json = JSON.stringify([
    { id: 'x', 科目: 'a', 問題文: 'q1', 選択肢: ['あ', 'い'], 正解: 1 },
    { id: 'x', 科目: 'a', 問題文: 'q2', 選択肢: ['あ', 'い'], 正解: 1 },
  ]);
  const { warnings } = importJson(json);
  assert.ok(warnings.some((w) => w.includes('重複')));
});

test('画像列を取り込める（カンマを含むためCSVでは引用符で囲む）', () => {
  const csv = `科目,問題文,選択肢,正解,解説,画像
経穴,問7,あ|い|う|え,1,解説7,"data:image/png;base64,AAAA"`;
  const { questions } = importCsv(csv);
  assert.equal(questions[0].image, 'data:image/png;base64,AAAA');
});

test('CSV 内の引用符・カンマを正しく解釈する', () => {
  const csv = `科目,問題文,選択肢,正解,解説
生理,"問, 8 ""引用""",あ|い,1,"改行\nあり"`;
  const { questions } = importCsv(csv);
  assert.equal(questions[0].question, '問, 8 "引用"');
  assert.ok(questions[0].explanation.includes('改行'));
});

test('JSON round-trip: choices/answer 形式をそのまま読める', () => {
  const original = [
    { id: 'a1', subject: 'S', type: 'choice', question: 'Q', choices: ['x', 'y', 'z', 'w'], answer: 2, explanation: 'E' },
  ];
  const { questions } = importJson(JSON.stringify(original));
  assert.equal(questions[0].answer, 2);
  assert.equal(questions[0].choices.length, 4);
});

test('exportCsv → importCsv で四択/○×が保たれる', () => {
  const qs = [
    { id: 'a', subject: 'S1', type: 'choice', question: 'Q1', choices: ['a', 'b', 'c', 'd'], answer: 1, explanation: 'e1' },
    { id: 'b', subject: 'S2', type: 'ox', question: 'Q2', choices: ['○（正しい）', '×（誤り）'], answer: 1, explanation: 'e2' },
  ];
  const csv = exportCsv(qs);
  const { questions } = importCsv(csv);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].answer, 1);
  assert.equal(questions[1].type, 'ox');
  assert.equal(questions[1].answer, 1);
});

test('問題文が空の行はエラーとして報告される', () => {
  const csv = `科目,問題文,選択肢,正解,解説
生理,,あ|い,1,解説`;
  const { questions, errors } = importCsv(csv);
  assert.equal(questions.length, 0);
  assert.equal(errors.length, 1);
});
