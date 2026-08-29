import test from 'node:test';
import assert from 'node:assert/strict';

import { tocItems, tocSections } from '../src/data/toc.js';
import { HACK_MAP } from '../src/data/hacks.js';
import { CATEGORY_MAP } from '../src/data/schema.js';
import { numberToKana, readingInfo, buildKanaIndex, GROUP_ORDER, OTHER_GROUP } from '../src/lib/yomi.js';

test('数字は読みで振り分ける（見た目の数字順で先頭に固めない）', () => {
  assert.equal(numberToKana(3), 'さん');
  assert.equal(numberToKana(20), 'にじゅう');
  assert.equal(numberToKana(361), 'さんびゃくろくじゅういち');
  assert.equal(numberToKana(0), 'ぜろ');
  assert.equal(readingInfo('20歳未満').group, 'な');
  assert.equal(readingInfo('3分ルール', 'さんぷんるーる').group, 'さ');
});

test('読みが無い（漢字が残る）項目は「その他」に落として、入れ忘れを見せる', () => {
  assert.equal(readingInfo('片づけ').group, OTHER_GROUP);
});

test('並びは あ〜ん → A〜Z → その他', () => {
  const sections = buildKanaIndex([
    { title: 'Bアプリ', reading: 'bあぷり' },
    { title: '漢字' },
    { title: 'あさ', reading: 'あさ' },
    { title: 'わけ', reading: 'わけ' },
  ]);
  assert.deepEqual(sections.map((s) => s.group), ['あ', 'わ', 'A〜Z', 'その他']);
  const order = sections.map((s) => GROUP_ORDER.indexOf(s.group));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('目次に「その他」の行が出ない（＝読みの入れ忘れが無い）', () => {
  const other = tocSections().find((s) => s.group === OTHER_GROUP);
  assert.equal(other, undefined, other ? other.items.map((i) => i.title).join(',') : '');
});

test('目次のタイトルは重複しない', () => {
  const titles = tocItems().map((i) => i.title);
  const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
  assert.deepEqual(dup, []);
});

test('目次の飛び先は実在する（ライフハック本体・カテゴリとも）', () => {
  for (const item of tocItems()) {
    if (item.kind === 'hack') assert.ok(HACK_MAP[item.id], item.id);
    else if (item.kind === 'category') assert.ok(CATEGORY_MAP[item.id.replace('category:', '')], item.id);
    else assert.fail(`知らない kind: ${item.kind}`);
  }
});

test('行の中は読みの順に並ぶ', () => {
  for (const section of tocSections()) {
    const keys = section.items.map((i) => i.key);
    assert.deepEqual(keys, [...keys].sort((a, b) => a.localeCompare(b, 'ja')), section.group);
  }
});
