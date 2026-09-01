import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAM_BLUEPRINT_AM, EXAM_BLUEPRINT_PM, EXAM_BLUEPRINTS } from '../src/data/examBlueprint.js';

// #1・#3・#9：配分の合計・構造が崩れていないかを機械チェックする。
// 出題基準そのものの数値検証（配分比率が公式資料と一致しているか）は手元に無い基準なので
// ここでは行わない（examBlueprint.js冒頭のコメント・CLAUDE.mdの確認運用に委ねる）。
test('EXAM_BLUEPRINT_AM: スロット合計がtotalCountと一致する', () => {
  const sum = EXAM_BLUEPRINT_AM.slots.reduce((s, x) => s + x.count, 0);
  assert.equal(sum, EXAM_BLUEPRINT_AM.totalCount);
});

test('EXAM_BLUEPRINT_PM: スロット合計がtotalCountと一致する', () => {
  const sum = EXAM_BLUEPRINT_PM.slots.reduce((s, x) => s + x.count, 0);
  assert.equal(sum, EXAM_BLUEPRINT_PM.totalCount);
});

test('EXAM_BLUEPRINTS: 各スロットにsubject・countが必須項目として揃っている', () => {
  for (const bp of EXAM_BLUEPRINTS) {
    for (const slot of bp.slots) {
      assert.ok(slot.subject, `${bp.session}: subjectが空のスロットがあります`);
      assert.ok(Number.isInteger(slot.count) && slot.count > 0, `${bp.session}.${slot.subject}: countが不正です`);
    }
  }
});

test('EXAM_BLUEPRINTS: 総合問題スロットはintegrated情報一式を持つ', () => {
  for (const bp of EXAM_BLUEPRINTS) {
    const integrated = bp.slots.filter((s) => s.integrated);
    for (const slot of integrated) {
      assert.ok(slot.integratedSession, `${bp.session}: integratedSessionが空です`);
      assert.ok(Array.isArray(slot.fallbackSubjects) && slot.fallbackSubjects.length > 0, `${bp.session}: fallbackSubjectsが空です`);
    }
  }
});
