import { test } from 'node:test';
import assert from 'node:assert/strict';
import { G100_INTRO, G100_PHASES, G100_NOTEBOOK_NOTE } from '../src/data/g100Guide.js';
import featureRegistry from '../src/data/featureRegistry.js';

const KNOWN_VIEWS = new Set(featureRegistry.map((f) => f.view));

test('G100_INTRO: 空でない導入文がある', () => {
  assert.ok(G100_INTRO && G100_INTRO.length > 10);
});

test('G100_PHASES: 3フェーズ（Phase1〜3）がある', () => {
  assert.equal(G100_PHASES.length, 3);
  assert.deepEqual(G100_PHASES.map((p) => p.id), ['phase1', 'phase2', 'phase3']);
});

test('G100_PHASES: 各フェーズが必須フィールドを備える', () => {
  for (const phase of G100_PHASES) {
    assert.ok(phase.range && phase.range.length > 0, `${phase.id}: rangeが空`);
    assert.ok(phase.title && phase.title.length > 0, `${phase.id}: titleが空`);
    assert.ok(phase.goal && phase.goal.length > 0, `${phase.id}: goalが空`);
    assert.ok(Array.isArray(phase.sections) && phase.sections.length > 0, `${phase.id}: sectionsが空`);
    assert.ok(phase.doneWhen && phase.doneWhen.length > 0, `${phase.id}: doneWhenが空`);
  }
});

test('G100_PHASES: 各セクションが必須フィールドと1件以上のitemsを備える', () => {
  for (const phase of G100_PHASES) {
    for (const sec of phase.sections) {
      assert.ok(sec.range, `${phase.id}/${sec.id}: rangeが空`);
      assert.ok(sec.title, `${phase.id}/${sec.id}: titleが空`);
      assert.ok(Array.isArray(sec.items) && sec.items.length > 0, `${phase.id}/${sec.id}: itemsが空`);
      for (const item of sec.items) {
        assert.ok(item.text && item.text.length > 5, `${phase.id}/${sec.id}: itemのtextが短すぎる`);
      }
    }
  }
});

test('G100_PHASES: セクションid・フェーズidが重複しない', () => {
  assert.equal(new Set(G100_PHASES.map((p) => p.id)).size, G100_PHASES.length);
  const allSectionIds = G100_PHASES.flatMap((p) => p.sections.map((s) => s.id));
  assert.equal(new Set(allSectionIds).size, allSectionIds.length);
});

test('G100_PHASES: すべてのlinksのviewが実在の画面（featureRegistryに登録済み）を指す', () => {
  const badLinks = [];
  for (const phase of G100_PHASES) {
    for (const sec of phase.sections) {
      for (const item of sec.items) {
        for (const link of item.links || []) {
          if (!KNOWN_VIEWS.has(link.view)) badLinks.push(`${phase.id}/${sec.id}: ${link.view}`);
        }
      }
    }
    for (const link of phase.doneLinks || []) {
      if (!KNOWN_VIEWS.has(link.view)) badLinks.push(`${phase.id}(doneLinks): ${link.view}`);
    }
  }
  assert.deepEqual(badLinks, []);
});

test('G100_NOTEBOOK_NOTE: テキストとlinksを備え、linksは実在の画面を指す', () => {
  assert.ok(G100_NOTEBOOK_NOTE.text && G100_NOTEBOOK_NOTE.text.length > 10);
  assert.ok(Array.isArray(G100_NOTEBOOK_NOTE.links) && G100_NOTEBOOK_NOTE.links.length > 0);
  for (const link of G100_NOTEBOOK_NOTE.links) {
    assert.ok(KNOWN_VIEWS.has(link.view), `未知のview: ${link.view}`);
  }
});
