import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExperienceDraft } from '../src/lib/experienceDraft.js';

test('buildExperienceDraft: 空の履歴でも落ちない', () => {
  const out = buildExperienceDraft({});
  assert.match(out, /延べ0問/);
  assert.match(out, /通算正答率は—/);
});

test('buildExperienceDraft: 統計値が文中に反映される', () => {
  const history = [
    { questionId: 'a', correct: true, at: 1 },
    { questionId: 'b', correct: false, at: 2 },
    { questionId: 'c', correct: true, at: 3 },
  ];
  const examResults = [
    { mode: 'am', modeLabel: '午前', scorePct: 70 },
    { mode: 'pm', modeLabel: '午後', scorePct: 85 },
  ];
  const out = buildExperienceDraft({ history, examResults, level: { label: '中級者' } });
  assert.match(out, /延べ3問/);
  assert.match(out, /通算正答率は67%/);
  assert.match(out, /ベストスコアは85%/);
  assert.match(out, /中級者/);
});

test('buildExperienceDraft: 得意/苦手モードなど午前午後以外の模試は除外', () => {
  const examResults = [{ mode: 'weak', modeLabel: '苦手', scorePct: 99 }];
  const out = buildExperienceDraft({ examResults });
  assert.ok(!out.includes('99%'));
});
