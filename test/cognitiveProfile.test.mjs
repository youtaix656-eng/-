import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE, RECOMMENDATIONS, ENVIRONMENT_TIPS, SHORTEST_ROUTE, AVOID_METHODS, GROWTH_AREAS, DEPRIORITIZED_TYPES, TRAINING_GAMES } from '../src/lib/cognitiveProfile.js';

// CognitiveTraining.jsx が実装しているモードの一覧（cognitiveProfile.js の
// TRAINING_GAMES.mode が指す先）。新しいゲームを追加したら両方を更新すること。
const IMPLEMENTED_MODES = new Set([
  'spatial-memory', 'sequence-memory', 'story-builder', 'assoc-chain',
  'read-copy', 'summarize', 'fill-blank', 'kanji-breakdown', 'shadowing', 'qa-pacing',
]);
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
  const text = JSON.stringify({ PROFILE, RECOMMENDATIONS, ENVIRONMENT_TIPS, GROWTH_AREAS, DEPRIORITIZED_TYPES, TRAINING_GAMES });
  assert.ok(!text.includes('小島'), '個人名が含まれている');
});

test('cognitiveProfile: TRAINING_GAMESが必須フィールドを備え、CognitiveTraining.jsxに実装がある', () => {
  assert.ok(TRAINING_GAMES.length > 0);
  TRAINING_GAMES.forEach((g) => {
    assert.ok(g.id, 'idが空');
    assert.ok(g.mode, `${g.id}: modeが空`);
    assert.ok(g.section, `${g.id}: sectionが空`);
    assert.ok(g.type, `${g.id}: typeが空`);
    assert.ok(g.title, `${g.id}: titleが空`);
    assert.ok(g.desc, `${g.id}: descが空`);
    assert.ok(IMPLEMENTED_MODES.has(g.mode), `${g.id}: mode "${g.mode}" がCognitiveTraining.jsxに実装されていない`);
  });
});

test('cognitiveProfile: TRAINING_GAMESのid・modeが重複しない', () => {
  const ids = TRAINING_GAMES.map((g) => g.id);
  const modes = TRAINING_GAMES.map((g) => g.mode);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(modes).size, modes.length);
});

test('cognitiveProfile: TRAINING_GAMESは「得意を伸ばす」「苦手を鍛える」の両方を含む', () => {
  const sections = new Set(TRAINING_GAMES.map((g) => g.section));
  assert.ok(sections.has('得意を伸ばす'));
  assert.ok(sections.has('苦手を鍛える'));
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
