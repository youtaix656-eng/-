import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE, RECOMMENDATIONS, ENVIRONMENT_TIPS, SHORTEST_ROUTE, AVOID_METHODS, GROWTH_AREAS, DEPRIORITIZED_TYPES } from '../src/lib/cognitiveProfile.js';
import featureRegistry from '../src/data/featureRegistry.js';

const KNOWN_VIEWS = new Set(featureRegistry.map((f) => f.view));

test('cognitiveProfile: PROFILEに見出し・要約・強み・弱みがある', () => {
  assert.ok(PROFILE.headline);
  assert.ok(PROFILE.summary);
  assert.ok(PROFILE.strengths.length > 0);
  assert.ok(PROFILE.weaknesses.length > 0);
});

test('cognitiveProfile: PROFILE.insight（タイプ間の関連性の補足）がある', () => {
  assert.ok(PROFILE.insight && PROFILE.insight.length > 0);
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

test('cognitiveProfile: 最短ルート・避けたほうがよい学習法が空でない', () => {
  assert.ok(SHORTEST_ROUTE.length > 0);
  assert.ok(AVOID_METHODS.length > 0);
});

test('cognitiveProfile: 個人名を含まない（公開リポジトリのため）', () => {
  const text = JSON.stringify({ PROFILE, RECOMMENDATIONS, ENVIRONMENT_TIPS, GROWTH_AREAS, DEPRIORITIZED_TYPES });
  assert.ok(!text.includes('小島'), '個人名が含まれている');
});

test('cognitiveProfile: GROWTH_AREASが必須フィールドとトレーニングを備える', () => {
  assert.ok(GROWTH_AREAS.length > 0);
  GROWTH_AREAS.forEach((g) => {
    assert.ok(g.id, 'idが空');
    assert.ok(g.rank, `${g.id}: rankが空`);
    assert.ok(g.type, `${g.id}: typeが空`);
    assert.ok(g.reason, `${g.id}: reasonが空`);
    assert.ok(g.frequency, `${g.id}: frequencyが空`);
    assert.ok(Array.isArray(g.trainings) && g.trainings.length > 0, `${g.id}: trainingsが空`);
    g.trainings.forEach((t) => {
      assert.ok(t.title, `${g.id}: trainingのtitleが空`);
      assert.ok(t.desc, `${g.id}/${t.title}: descが空`);
      assert.ok(Array.isArray(t.links) && t.links.length > 0, `${g.id}/${t.title}: linksが空`);
      t.links.forEach((l) => {
        assert.ok(KNOWN_VIEWS.has(l.view), `${g.id}/${t.title}: view "${l.view}" がfeatureRegistry.jsに存在しない`);
        assert.ok(l.label, `${g.id}/${t.title}: リンクのlabelが空`);
      });
    });
  });
});

test('cognitiveProfile: GROWTH_AREASのidが重複しない', () => {
  const ids = GROWTH_AREAS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('cognitiveProfile: DEPRIORITIZED_TYPESが空でなく理由を備える', () => {
  assert.ok(DEPRIORITIZED_TYPES.length > 0);
  DEPRIORITIZED_TYPES.forEach((d) => {
    assert.ok(d.type, 'typeが空');
    assert.ok(d.reason, `${d.type}: reasonが空`);
  });
});
