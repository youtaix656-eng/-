import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSymptom, isKnownTag, parseTag } from '../src/data/schema.js';
import { LOW_BACK } from '../src/data/lowBack.js';
import { SYMPTOMS } from '../src/data/symptoms.js';

test('parseTag / isKnownTag', () => {
  assert.deepEqual(parseTag('aggr:flexion'), { group: 'aggr', value: 'flexion' });
  assert.equal(isKnownTag('aggr:flexion'), true);
  assert.equal(isKnownTag('aggr:typo'), false);
  assert.equal(isKnownTag('flexion'), false);
});

test('登録済みの症状モジュールはすべてスキーマ検証を通る', () => {
  for (const s of SYMPTOMS) {
    assert.deepEqual(validateSymptom(s), [], `${s.id} に問題があります`);
  }
});

test('腰痛モジュール: すべての field が既知の step に属する', () => {
  const steps = new Set(LOW_BACK.steps.map((s) => s.id));
  for (const f of LOW_BACK.fields) {
    assert.ok(steps.has(f.step), `${f.id} の step「${f.step}」が steps に存在しません`);
  }
});

test('腰痛モジュール: 各 step に最低1つ field がある（空の画面を作らない）', () => {
  for (const s of LOW_BACK.steps) {
    const n = LOW_BACK.fields.filter((f) => f.step === s.id).length;
    assert.ok(n > 0, `step ${s.id} に field がありません`);
  }
});

test('パターン・レッドフラグが参照する出典IDは実在する', async () => {
  const { SOURCE_MAP } = await import('../src/data/sources.js');
  const ids = [
    ...LOW_BACK.patterns.flatMap((p) => p.sourceIds || []),
    ...LOW_BACK.redFlags.flatMap((f) => f.sourceIds || []),
  ];
  for (const id of ids) assert.ok(SOURCE_MAP[id], `未知の出典ID: ${id}`);
});

test('施術方針の modality はすべて既知（資格による出し分けが効く）', async () => {
  const { MODALITIES } = await import('../src/data/licenses.js');
  for (const p of LOW_BACK.patterns) {
    for (const a of p.approaches || []) {
      assert.ok(MODALITIES[a.modality], `${p.id}: 未知の modality「${a.modality}」`);
    }
  }
});
