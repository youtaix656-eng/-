import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE, RECOMMENDATIONS, ENVIRONMENT_TIPS } from '../src/lib/cognitiveProfile.js';
import featureRegistry from '../src/data/featureRegistry.js';

const KNOWN_VIEWS = new Set(featureRegistry.map((f) => f.view));

test('cognitiveProfile: PROFILEに見出し・要約・強み・弱みがある', () => {
  assert.ok(PROFILE.headline);
  assert.ok(PROFILE.summary);
  assert.ok(PROFILE.strengths.length > 0);
  assert.ok(PROFILE.weaknesses.length > 0);
});

test('cognitiveProfile: 各推奨事項が必須フィールドを備える', () => {
  RECOMMENDATIONS.forEach((r) => {
    assert.ok(r.id, 'idが空');
    assert.ok(r.category, `${r.id}: categoryが空`);
    assert.ok(r.title, `${r.id}: titleが空`);
    assert.ok(r.reason, `${r.id}: reasonが空`);
    assert.ok(Array.isArray(r.links) && r.links.length > 0, `${r.id}: linksが空`);
  });
});

test('cognitiveProfile: idが重複しない', () => {
  const ids = RECOMMENDATIONS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('cognitiveProfile: 各リンク先のviewはfeatureRegistry.jsに実在する', () => {
  RECOMMENDATIONS.forEach((r) => {
    r.links.forEach((l) => {
      assert.ok(KNOWN_VIEWS.has(l.view), `${r.id}: view "${l.view}" がfeatureRegistry.jsに存在しない`);
      assert.ok(l.label, `${r.id}: リンクのlabelが空`);
    });
  });
});

test('cognitiveProfile: 環境アドバイスが空でない', () => {
  assert.ok(ENVIRONMENT_TIPS.length > 0);
});

test('cognitiveProfile: 個人名を含まない（公開リポジトリのため）', () => {
  const text = JSON.stringify({ PROFILE, RECOMMENDATIONS, ENVIRONMENT_TIPS });
  assert.ok(!text.includes('小島'), '個人名が含まれている');
});
