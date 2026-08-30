import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moodToConditionScore, moodDayKey, MOODS } from '../src/lib/mood.js';

test('moodToConditionScore: 元気/普通/しんどいを0-100へ変換', () => {
  assert.equal(moodToConditionScore('good'), 80);
  assert.equal(moodToConditionScore('normal'), 50);
  assert.equal(moodToConditionScore('tired'), 20);
});

test('moodToConditionScore: 未記録(null)や不明な値はnull', () => {
  assert.equal(moodToConditionScore(null), null);
  assert.equal(moodToConditionScore(undefined), null);
  assert.equal(moodToConditionScore('unknown'), null);
});

test('moodToConditionScore: 全MOODSに変換値がある', () => {
  for (const m of MOODS) {
    assert.notEqual(moodToConditionScore(m.id), null);
  }
});

test('moodDayKey: 同じ日は同じキー、日が変われば違うキー', () => {
  const t1 = new Date('2026-08-23T05:00:00').getTime();
  const t2 = new Date('2026-08-23T23:00:00').getTime();
  const t3 = new Date('2026-08-24T05:00:00').getTime();
  assert.equal(moodDayKey(t1), moodDayKey(t2));
  assert.notEqual(moodDayKey(t1), moodDayKey(t3));
});
