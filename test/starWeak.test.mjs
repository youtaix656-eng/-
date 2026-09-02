import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starLevelOf, starLabel, STAR_RULES } from '../src/lib/starWeak.js';

test('starLevelOf: 記録が無ければ0（★なし）', () => {
  assert.equal(starLevelOf(undefined), 0);
  assert.equal(starLevelOf({}), 0);
  assert.equal(starLevelOf({ sankaku: 0, batsu: 0 }), 0);
});

test('starLevelOf: ✕2回以上で★3', () => {
  assert.equal(starLevelOf({ sankaku: 0, batsu: STAR_RULES.batsuFor3 }), 3);
  assert.equal(starLevelOf({ sankaku: 0, batsu: STAR_RULES.batsuFor3 + 5 }), 3);
  assert.equal(starLevelOf({ sankaku: 0, batsu: STAR_RULES.batsuFor3 - 1 }), 0);
});

test('starLevelOf: △3回以上で★2', () => {
  assert.equal(starLevelOf({ sankaku: STAR_RULES.sankakuFor2, batsu: 0 }), 2);
  assert.equal(starLevelOf({ sankaku: STAR_RULES.sankakuFor2 - 1, batsu: 0 }), 0);
});

test('starLevelOf: ✕優先（✕2回以上なら△が何回あっても★3のまま）', () => {
  assert.equal(starLevelOf({ sankaku: 99, batsu: STAR_RULES.batsuFor3 }), 3);
});

test('starLabel: レベルに応じて★を並べる', () => {
  assert.equal(starLabel(0), '');
  assert.equal(starLabel(1), '★');
  assert.equal(starLabel(2), '★★');
  assert.equal(starLabel(3), '★★★');
});
