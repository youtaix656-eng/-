import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendNewPct } from '../src/lib/reviewPool.js';

test('recommendNewPct: 従来どおり（stalledDays省略）復習量から比率を決める', () => {
  assert.equal(recommendNewPct(10, 0).pct, 100);
  assert.equal(recommendNewPct(0, 5).pct, 0);
  assert.equal(recommendNewPct(10, 35).pct, 30);
  assert.equal(recommendNewPct(10, 15).pct, 50);
  assert.equal(recommendNewPct(10, 5).pct, 70);
});

test('recommendNewPct: stalledDaysが3未満なら通常どおり（#17）', () => {
  const rec = recommendNewPct(10, 5, 2);
  assert.equal(rec.pct, 70);
});

test('recommendNewPct: 3日以上ゼロに戻せていない時は復習側へさらに寄せる（#17）', () => {
  const rec = recommendNewPct(10, 15, 3);
  assert.equal(rec.pct, 10);
  assert.match(rec.reason, /3日ゼロに戻せていない/);
});

test('recommendNewPct: 停滞中でも復習が少なければ極端に0にはしない', () => {
  const rec = recommendNewPct(10, 5, 5);
  assert.equal(rec.pct, 30);
});
