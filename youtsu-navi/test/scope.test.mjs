import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateApproach, splitByScope } from '../src/lib/scope.js';

test('鍼灸師にマッサージ（手技）を提案したら業務範囲外として警告する', () => {
  const r = evaluateApproach({ modality: 'manual', text: 'x' }, 'shinkyu');
  assert.equal(r.status, 'out');
  assert.ok(r.note.includes('※要確認'));
});

test('あん摩マッサージ指圧師に刺鍼を提案したら業務範囲外', () => {
  assert.equal(evaluateApproach({ modality: 'acupuncture', text: 'x' }, 'anma').status, 'out');
});

test('整体師の手技は範囲内だが注意付き（無免許のあん摩マッサージ指圧にならないよう）', () => {
  const r = evaluateApproach({ modality: 'manual', text: 'x' }, 'seitai');
  assert.equal(r.status, 'caution');
  assert.ok(r.note.length > 0);
});

test('整体師に整復・固定は業務範囲外', () => {
  assert.equal(evaluateApproach({ modality: 'judo', text: 'x' }, 'seitai').status, 'out');
});

test('柔道整復師の整復・固定は範囲内', () => {
  assert.equal(evaluateApproach({ modality: 'judo', text: 'x' }, 'judo').status, 'ok');
});

test('生活指導はどの資格でも範囲内', () => {
  for (const id of ['anma', 'shinkyu', 'judo', 'seitai']) {
    assert.notEqual(evaluateApproach({ modality: 'education', text: 'x' }, id).status, 'out');
  }
});

test('資格未設定なら caution にして設定を促す', () => {
  const r = evaluateApproach({ modality: 'manual', text: 'x' }, null);
  assert.equal(r.status, 'caution');
  assert.ok(r.note.includes('資格が未設定'));
});

test('splitByScope が範囲内／範囲外に分ける', () => {
  const approaches = [
    { modality: 'manual', text: 'a' },
    { modality: 'acupuncture', text: 'b' },
    { modality: 'education', text: 'c' },
  ];
  const { inScope, outOfScope } = splitByScope(approaches, 'anma');
  assert.equal(inScope.length, 2);
  assert.equal(outOfScope.length, 1);
  assert.equal(outOfScope[0].modality, 'acupuncture');
});
