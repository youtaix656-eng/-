import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isConsentValid, makeConsentRecord, CONSENT_VERSION, CONSENT_TEXT } from '../src/lib/consent.js';
import { precautionsFor } from '../src/data/precautions.js';

test('同意が無い／版が古い場合は無効（再同意を求める）', () => {
  assert.equal(isConsentValid(null), false);
  assert.equal(isConsentValid({ agreedAt: Date.now(), version: '0.0.1' }), false);
  assert.equal(isConsentValid({ agreedAt: Date.now(), version: CONSENT_VERSION }), true);
});

test('同意記録はID・日時・版・資格を持つ', () => {
  const rec = makeConsentRecord({ licenseId: 'anma', at: 1700000000000 });
  assert.equal(rec.at, 1700000000000);
  assert.equal(rec.version, CONSENT_VERSION);
  assert.equal(rec.licenseId, 'anma');
  assert.ok(rec.id.length > 0);
});

test('同意文には「診断ではない」「最終判断は施術者」が含まれる', () => {
  const text = CONSENT_TEXT.items.join('');
  assert.ok(text.includes('診断'));
  assert.ok(text.includes('施術者本人'));
  assert.ok(text.includes('端末'));
});

test('要配慮対象: 妊娠タグで妊娠中のチェックリストが出る', () => {
  const ids = precautionsFor(['special:pregnancy']).map((p) => p.id);
  assert.deepEqual(ids, ['pregnancy']);
});

test('要配慮対象: 骨粗鬆症・ステロイドは同じチェックリストに集約される', () => {
  assert.deepEqual(precautionsFor(['history:steroid']).map((p) => p.id), ['osteoporosis']);
});

test('要配慮対象: 該当なしなら空', () => {
  assert.deepEqual(precautionsFor(['aggr:flexion']), []);
});
