import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTocItems, buildToc, TOC_VIEWS, TRAIT_READINGS, FORMAT_READINGS } from '../src/data/toc.js';
import { TRAIT_VOCABULARY, FORMAT_VOCABULARY } from '../src/data/exams.js';
import { readingInfo, buildKanaIndex, numberToKana, OTHER_GROUP, GROUP_ORDER } from '../src/lib/yomi.js';

test('タイトルが重複していない', () => {
  const items = buildTocItems();
  const seen = new Map();
  const dup = [];
  for (const i of items) {
    if (seen.has(i.title)) dup.push(i.title);
    seen.set(i.title, true);
  }
  assert.deepEqual(dup, [], `重複したタイトル：${dup.join('、')}`);
});

// 読みの入れ忘れは「その他」に落ちることで見える。落ちたら落とす。
test('読みの入れ忘れが無い（「その他」の行が空）', () => {
  const other = buildToc().find((s) => s.group === OTHER_GROUP);
  const titles = other ? other.items.map((i) => i.title) : [];
  assert.deepEqual(titles, [], `読みが無い項目：${titles.join('、')}`);
});

test('飛び先（view）が実在する', () => {
  for (const i of buildTocItems()) {
    assert.ok(TOC_VIEWS.includes(i.view), `${i.title} の view が未定義：${i.view}`);
  }
});

test('試験の性格・出題形式の読みが、語彙と1対1でそろっている', () => {
  for (const id of Object.keys(TRAIT_VOCABULARY)) {
    assert.ok(TRAIT_READINGS[id], `trait「${id}」の読みが TRAIT_READINGS にありません`);
  }
  for (const id of Object.keys(FORMAT_VOCABULARY)) {
    assert.ok(FORMAT_READINGS[id], `format「${id}」の読みが FORMAT_READINGS にありません`);
  }
  // 余分な読みを残さない（語彙から消したのに読みだけ残る状態を防ぐ）
  for (const id of Object.keys(TRAIT_READINGS)) assert.ok(TRAIT_VOCABULARY[id], `使われていない読み：${id}`);
  for (const id of Object.keys(FORMAT_READINGS)) assert.ok(FORMAT_VOCABULARY[id], `使われていない読み：${id}`);
});

test('並びは あ〜ん → A〜Z → その他 の順', () => {
  const groups = buildToc().map((s) => s.group);
  const order = groups.map((g) => GROUP_ORDER.indexOf(g));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('数字は見た目ではなく読みで振り分ける', () => {
  assert.equal(numberToKana(20), 'にじゅう');
  assert.equal(numberToKana(361), 'さんびゃくろくじゅういち');
  assert.equal(readingInfo('20歳未満').group, 'な');
  assert.equal(readingInfo('361穴').group, 'さ');
  assert.equal(readingInfo('4類危険物').group, 'や'); // よんるい… → や行
  // 数字を含んでいても、**先頭が漢字なら読みを推定しない**（誤読を出さないため「その他」へ）
  assert.equal(readingInfo('第4類').group, OTHER_GROUP);
  assert.equal(readingInfo('第4類', 'だいよんるい').group, 'た');
});

test('読みが無い漢字の項目は自動で推定せず「その他」へ落ちる', () => {
  assert.equal(readingInfo('経絡経穴概論').group, OTHER_GROUP);
  assert.equal(readingInfo('経絡経穴概論', 'けいらくけいけつがいろん').group, 'か');
});

test('アルファベットで始まる項目は A〜Z へ入る', () => {
  assert.equal(readingInfo('FP技能士', 'FPぎのうし').group, 'A〜Z');
});

test('sortKey は行の振り分けを変えず、行の中の並びだけを変える', () => {
  const sections = buildKanaIndex([
    { title: 'あ第2', reading: 'あ', sortKey: '2' },
    { title: 'あ第1', reading: 'あ', sortKey: '1' },
  ]);
  assert.equal(sections[0].group, 'あ');
  assert.deepEqual(sections[0].items.map((i) => i.title), ['あ第1', 'あ第2']);
});
