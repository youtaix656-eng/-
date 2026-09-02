import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIORITY_FOCUS_ITEMS, suggestPriorityFocus } from '../src/lib/priorityFocus.js';

test('PRIORITY_FOCUS_ITEMS: 3件で、id・title・reason・view・ctaを持つ', () => {
  assert.equal(PRIORITY_FOCUS_ITEMS.length, 3);
  for (const it of PRIORITY_FOCUS_ITEMS) {
    assert.ok(it.id);
    assert.ok(it.title);
    assert.ok(it.reason);
    assert.ok(it.view);
    assert.ok(it.cta);
  }
});

test('suggestPriorityFocus: 消していなければ日替わりで候補から1件選ぶ', () => {
  const d1 = new Date('2026-09-02T00:00:00Z');
  const d2 = new Date('2026-09-03T00:00:00Z');
  const s1 = suggestPriorityFocus([], d1);
  const s2 = suggestPriorityFocus([], d2);
  assert.ok(s1);
  assert.ok(s2);
  assert.ok(PRIORITY_FOCUS_ITEMS.some((it) => it.id === s1.id));
});

test('suggestPriorityFocus: 同じ日は同じ提案になる', () => {
  const d = new Date('2026-09-02T05:00:00Z');
  const a = suggestPriorityFocus([], d);
  const b = suggestPriorityFocus([], d);
  assert.equal(a.id, b.id);
});

test('suggestPriorityFocus: 消した項目は候補から外れる', () => {
  const dismissed = PRIORITY_FOCUS_ITEMS.slice(0, 2).map((it) => it.id);
  const remaining = PRIORITY_FOCUS_ITEMS.filter((it) => !dismissed.includes(it.id));
  const result = suggestPriorityFocus(dismissed, new Date('2026-09-02T00:00:00Z'));
  assert.equal(result.id, remaining[0].id);
});

test('suggestPriorityFocus: 全部消していればnull', () => {
  const all = PRIORITY_FOCUS_ITEMS.map((it) => it.id);
  assert.equal(suggestPriorityFocus(all, new Date()), null);
});
