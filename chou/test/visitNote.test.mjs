import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDays } from '../src/lib/days.js';
import { buildVisitNote, visitNoteFilename, perDayText, DEFAULT_PARTS, NOTE_PARTS } from '../src/lib/visitNote.js';

const days = normalizeDays({
  '2026-09-01': {
    date: '2026-09-01',
    belly: 'hard',
    stools: [{ bristol: 6, marks: ['urgent'] }, { bristol: 7, marks: [] }],
    meals: [{ text: 'ヨーグルト' }],
    note: '会議の前から痛い',
  },
  '2026-09-02': {
    date: '2026-09-02',
    belly: 'very_hard',
    stools: [{ bristol: 1, marks: ['blood'] }],
    meals: [{ text: 'ヨーグルト' }],
  },
});
const keys = ['2026-09-01', '2026-09-02', '2026-09-03'];

test('本文には、数えたもとが必ず入る', () => {
  const text = buildVisitNote(days, keys, DEFAULT_PARTS);
  assert.match(text, /3日間のうち、記録した日 2日/);
  assert.match(text, /記録の無い日は「症状が無かった日」ではなく「記録していない日」です。/);
  assert.match(text, /診断ではありません/);
});

test('お通じは回数と分布で書く（平均を書かない）', () => {
  const text = buildVisitNote(days, keys, DEFAULT_PARTS);
  assert.match(text, /計3回/);
  assert.match(text, /1〜2（かたいほう）：1回/);
  assert.match(text, /6〜7（やわらかいほう）：2回/);
  assert.doesNotMatch(text, /平均/);
});

test('解釈・診断名を書かない', () => {
  const text = buildVisitNote(days, keys, NOTE_PARTS.map((p) => p.id));
  for (const bad of [/の疑い/, /と思われ/, /可能性が高い/, /過敏性腸症候群です/, /緊急度/, /危険度/]) {
    assert.doesNotMatch(text, bad);
  }
});

test('入れないものは本文に出ない（見せる範囲は本人が決める）', () => {
  const text = buildVisitNote(days, keys, ['stool']);
  assert.doesNotMatch(text, /よく食べていたもの/);
  assert.doesNotMatch(text, /本人のメモ/);
  assert.doesNotMatch(text, /お腹の調子（本人の感じ方/);
  assert.match(text, /お通じ/); // お通じだけは必ず入る
});

test('お通じは外せない（NOTE_PARTS の fixed）', () => {
  const stool = NOTE_PARTS.find((p) => p.id === 'stool');
  assert.equal(stool.fixed, true);
  const text = buildVisitNote(days, keys, []);
  assert.match(text, /■ お通じ/);
});

test('記録がゼロのときに、数字を作らない', () => {
  const text = buildVisitNote({}, keys, DEFAULT_PARTS);
  assert.match(text, /この期間の記録はまだありません。/);
  assert.doesNotMatch(text, /計0回/);
});

test('期間が空なら空文字（呼び出し側が出し分けられるように）', () => {
  assert.equal(buildVisitNote(days, [], DEFAULT_PARTS), '');
});

test('印は日数で並び、付いていない時もそう書く', () => {
  const text = buildVisitNote(days, keys, ['marks']);
  assert.match(text, /血が混じった：1日/);
  const none = buildVisitNote(normalizeDays({ '2026-09-01': { date: '2026-09-01', belly: 'easy' } }), keys, ['marks']);
  assert.match(none, /いずれも付いていません/);
});

test('書き出すファイル名に期間が入る', () => {
  assert.equal(visitNoteFilename(keys), 'onaka-kiroku_2026-09-01_2026-09-03.txt');
  assert.equal(visitNoteFilename([]), 'onaka-kiroku.txt');
});

test('幅が無いときに「1〜1回」と書かない', () => {
  assert.equal(perDayText({ min: 1, max: 1 }), '1日 1回');
  assert.equal(perDayText({ min: 0, max: 3 }), '1日 0〜3回');
  assert.equal(perDayText(null), '');
});
