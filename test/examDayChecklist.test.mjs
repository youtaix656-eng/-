import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChecklist, DEFAULT_ITEMS, STAGES } from '../src/lib/examDayChecklist.js';

test('buildChecklist: 既定項目がステージごとに分類される', () => {
  const out = buildChecklist([], {});
  assert.equal(out.byStage.length, STAGES.length);
  const beforeStage = out.byStage.find((s) => s.id === 'before');
  assert.ok(beforeStage.items.length > 0);
  assert.equal(out.total, DEFAULT_ITEMS.length);
  assert.equal(out.done, 0);
});

test('buildChecklist: チェック済みの件数が反映される', () => {
  const checked = { d1: true, m1: true };
  const out = buildChecklist([], checked);
  assert.equal(out.done, 2);
  const before = out.byStage.find((s) => s.id === 'before');
  const d1 = before.items.find((i) => i.id === 'd1');
  assert.equal(d1.done, true);
});

test('buildChecklist: 追加項目も対象ステージに含まれる', () => {
  const customItems = [{ id: 'custom-1', stage: 'arrival', text: '自分だけの持ち物' }];
  const out = buildChecklist(customItems, {});
  const arrival = out.byStage.find((s) => s.id === 'arrival');
  assert.ok(arrival.items.some((i) => i.id === 'custom-1'));
  assert.equal(out.total, DEFAULT_ITEMS.length + 1);
});
