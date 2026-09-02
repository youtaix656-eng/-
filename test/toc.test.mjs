import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildTocEntries,
  tocSections,
  duplicateTitles,
  resolveDestination,
  openTermAction,
  termPanelViewModel,
  NO_DESCRIPTION_TEXT,
  NO_DESTINATIONS_TEXT,
} from '../src/data/toc.js';
import { GLOSSARY_TERMS, effectiveGlossary } from '../src/data/glossaryTerms.js';

function makeTerm(overrides = {}) {
  return {
    id: 'gt-test',
    title: 'テスト用語',
    reading: 'てすとようご',
    category: 'keiraku',
    description: '説明文',
    descriptionStatus: 'verified',
    aliases: [],
    destinations: [],
    ...overrides,
  };
}

test('tocDerivedFromSourceData: buildTocEntriesは用語集（元データ）から毎回導出される', () => {
  const glossary = [makeTerm()];
  const entries = buildTocEntries(glossary);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'テスト用語');
  // 元データを変えれば導出結果も変わる（別データを手で複製していない証拠）
  const glossary2 = [makeTerm(), makeTerm({ id: 'gt-test2', title: '別の用語', reading: 'べつのようご' })];
  assert.equal(buildTocEntries(glossary2).length, 2);
});

test('noDuplicateTitlesInMergedToc: 本体の用語集（GLOSSARY_TERMS）は重複タイトルが無い', () => {
  const entries = buildTocEntries(GLOSSARY_TERMS);
  assert.deepEqual(duplicateTitles(entries), []);
});

test('noDuplicateTitlesInMergedToc: canonicalと別名を合わせた統合後のtoc全体で検出する', () => {
  const glossary = [
    makeTerm({ aliases: [{ title: '別の用語', reading: 'べつのようご' }] }),
    makeTerm({ id: 'gt-other', title: '別の用語', reading: 'べつのようご' }),
  ];
  const entries = buildTocEntries(glossary);
  assert.deepEqual(duplicateTitles(entries), ['別の用語']);
});

test('aliasesResolveToCanonicalTitle: 別名はcanonicalのidへ解決するsystem destinationを持つ', () => {
  const glossary = [makeTerm({ aliases: [{ title: 'ツボ的な別名', reading: 'つぼてきなべつめい' }] })];
  const entries = buildTocEntries(glossary);
  const aliasEntry = entries.find((e) => e.isAlias);
  assert.ok(aliasEntry);
  assert.equal(aliasEntry.targetId, 'gt-test');
  assert.equal(aliasEntry.destinations[0].type, 'system');
  assert.equal(aliasEntry.destinations[0].target, 'gt-test');
  const action = resolveDestination(aliasEntry.destinations[0]);
  assert.equal(action.kind, 'jumpTerm');
  assert.equal(action.targetId, 'gt-test');
});

test('otherRowCountDoesNotIncrease: 本体の用語集はreading未設定の項目が無い（その他行が空）', () => {
  const entries = buildTocEntries(GLOSSARY_TERMS);
  const sections = tocSections(entries);
  const other = sections.find((s) => s.label === '漢字・その他');
  assert.equal(other, undefined, '本体データにreading未設定の項目があります');
});

test('sortsInGojuonOrder: 実データでもあ〜ん→A〜Zの順で並ぶ', () => {
  const entries = buildTocEntries(GLOSSARY_TERMS);
  const sections = tocSections(entries);
  const labels = sections.map((s) => s.label);
  const sorted = [...labels].sort((a, b) => {
    const order = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ', 'A〜Z', '漢字・その他'];
    return order.indexOf(a) - order.indexOf(b);
  });
  assert.deepEqual(labels, sorted);
});

test('destinationButtonsRenderForEachType: 4種類のdestinationがそれぞれ正しいkindに解決される', () => {
  assert.deepEqual(resolveDestination({ type: 'page', target: 'kgraph' }), { kind: 'navigate', view: 'kgraph' });
  assert.deepEqual(resolveDestination({ type: 'function', target: 'openKeyword', arg: '経絡' }), {
    kind: 'relay',
    relay: 'openKeyword',
    arg: '経絡',
  });
  assert.deepEqual(resolveDestination({ type: 'question', target: 'kk-keiraku-a1' }), {
    kind: 'startQuestion',
    questionId: 'kk-keiraku-a1',
  });
  assert.deepEqual(resolveDestination({ type: 'system', target: 'gt-genketsu' }), {
    kind: 'jumpTerm',
    targetId: 'gt-genketsu',
  });
  assert.equal(resolveDestination(null), null);
  assert.equal(resolveDestination({ type: 'unknown' }), null);
});

test('destinationButtonJumpsAndHighlights: systemタイプはジャンプ先の用語のアンカーへ解決する', () => {
  const action = openTermAction('gt-genketsu');
  assert.equal(action.anchor, 'toc-term-gt-genketsu');
  assert.equal(action.tab, 'index');
  assert.equal(action.openTermId, 'gt-genketsu');
});

test('tabSwitchesBeforeFlash: 用語を開く意図は常に索引タブへ固定される（どこから開いても）', () => {
  // 呼び出し元のタブに関わらず、openTermActionの戻り値は常にtab:'index'
  assert.equal(openTermAction('gt-a').tab, 'index');
  assert.equal(openTermAction('gt-b').tab, 'index');
});

test('doesNotResetScrollAfterJump: anchorが空になった時に画面を先頭へ戻す副作用を持たない', () => {
  const src = readFileSync(new URL('../src/components/Toc.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(
    src,
    /activeAnchor[\s\S]{0,120}(scrollTo\(0|scrollTop\s*=\s*0)/,
    'Toc.jsx: activeAnchorが空になった時にスクロールを先頭へ戻す副作用があります'
  );
});

test('tapOpensPanelWithDescription: 用語を開くと説明文が見える形になる', () => {
  const glossary = [makeTerm({ description: '経絡上の要穴の一つ。' })];
  const entries = buildTocEntries(glossary);
  const vm = termPanelViewModel(entries[0]);
  assert.equal(vm.descriptionText, '経絡上の要穴の一つ。');
});

test('missingDescriptionShowsPlaceholder: 説明が空なら「※説明未登録」を表示する', () => {
  const vm = termPanelViewModel(makeTerm({ description: '' }));
  assert.equal(vm.descriptionText, NO_DESCRIPTION_TEXT);
  const vm2 = termPanelViewModel(makeTerm({ description: '   ' }));
  assert.equal(vm2.descriptionText, NO_DESCRIPTION_TEXT);
});

test('emptyDestinationsHidesButtonArea: destinationsが空なら「関連する飛び先はありません」を表示する', () => {
  const vm = termPanelViewModel(makeTerm({ destinations: [] }));
  assert.equal(vm.hasDestinations, false);
  assert.equal(vm.emptyDestinationsMessage, NO_DESTINATIONS_TEXT);
  const vm2 = termPanelViewModel(makeTerm({ destinations: [{ type: 'page', target: 'kgraph', label: '見る' }] }));
  assert.equal(vm2.hasDestinations, true);
});

test('needsReviewBadgeAlwaysShown: descriptionStatusがneeds_reviewなら必ずバッジが立つ', () => {
  const vm1 = termPanelViewModel(makeTerm({ descriptionStatus: 'needs_review' }));
  assert.equal(vm1.showNeedsReview, true);
  const vm2 = termPanelViewModel(makeTerm({ descriptionStatus: 'verified' }));
  assert.equal(vm2.showNeedsReview, false);
});

test('verifiedOnlyByExplicitUserAction: 本体データの用語はすべてverifiedか、明示的にneeds_reviewを選んだものだけ', () => {
  // 本体データ（GLOSSARY_TERMS）は人が直接書いたものなので、descriptionStatusは
  // 'verified'|'needs_review'のいずれか（未設定・不正な値は無い）——candidatesフロー
  // 経由（自動でneeds_review）以外の経路で紛れ込んでいないことの確認。
  for (const t of GLOSSARY_TERMS) {
    assert.ok(
      t.descriptionStatus === 'verified' || t.descriptionStatus === 'needs_review',
      `${t.title}: descriptionStatusが不正です`
    );
  }
});

test('effectiveGlossary: 実行時追加分と合わさり、削除IDは除外される', () => {
  const extra = [makeTerm({ id: 'gt-extra' })];
  const removed = [GLOSSARY_TERMS[0].id];
  const full = effectiveGlossary(extra, removed);
  assert.ok(full.some((t) => t.id === 'gt-extra'));
  assert.ok(!full.some((t) => t.id === GLOSSARY_TERMS[0].id));
});
