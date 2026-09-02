import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  numberToKana,
  numberToReading,
  readingInfo,
  buildKanaIndex,
  foldKana,
  kanaRow,
  normalizeAlnum,
} from '../src/lib/yomi.js';

test('numberToKana: 数字を読みに（先頭かなが妥当）', () => {
  assert.ok(numberToKana(361).startsWith('さ')); // さんびゃく…
  assert.ok(numberToKana(12).startsWith('じ')); // じゅうに
  assert.equal(numberToKana(0), 'ぜろ');
  assert.ok(numberToKana(8).startsWith('は')); // はち
});

test('readingInfo: 種類ごとにグループ分け', () => {
  assert.equal(readingInfo('原穴').group, 'か'); // げんけつ → け → か行
  assert.equal(readingInfo('合谷').group, 'か'); // ごうこく → こ → か行
  assert.equal(readingInfo('Abc').group, '英字');
  assert.equal(readingInfo('abc').type, 'latin');
  assert.equal(readingInfo('361').group, 'さ'); // 数字も読みで
  assert.equal(readingInfo('あいうえお').group, 'あ');
});

test('buildKanaIndex: あ〜ん → A〜Z → 漢字 の順、英字は大小まとめて', () => {
  const kws = ['合谷', '原穴', 'Zebra', 'apple', '361', 'いちばん', '未知漢字語'];
  const idx = buildKanaIndex(kws);
  const labels = idx.map((s) => s.label);
  // か行（原穴・合谷）が英字より前
  assert.ok(labels.indexOf('か') < labels.indexOf('A〜Z'));
  // 英字は大小混在で apple, Zebra（case-insensitive → apple が先）
  const latin = idx.find((s) => s.label === 'A〜Z');
  assert.deepEqual(latin.items, ['apple', 'Zebra']);
  // 数字はさ行に入る
  const sa = idx.find((s) => s.label === 'さ');
  assert.ok(sa.items.includes('361'));
});

test('foldKana: 濁点・小書きを清音・大書きへ寄せる', () => {
  assert.equal(foldKana('ご'), 'こ');
  assert.equal(foldKana('ぱ'), 'は');
  assert.equal(foldKana('あ'), 'あ'); // 対象外の文字はそのまま
});

test('kanaRow: 行ラベルを返す（濁点等はfoldKana経由で判定）', () => {
  assert.equal(kanaRow('こ'), 'か');
  assert.equal(kanaRow('ご'), 'か'); // 濁点は清音側の行
  assert.equal(kanaRow('わ'), 'わ');
  assert.equal(kanaRow('1'), null); // かな以外はnull
});

test('numberToReading: numberToKanaと同じ読みを返す（目次系コードからの別名）', () => {
  assert.equal(numberToReading(361), numberToKana(361));
  assert.equal(numberToReading(0), 'ぜろ');
});

test('normalizeAlnum: 全角英字・ローマ数字を半角ラテン文字へ正規化する', () => {
  assert.equal(normalizeAlnum('ＷＨＯ'), 'WHO');
  assert.equal(normalizeAlnum('Ⅰ型'), 'I型');
  assert.equal(normalizeAlnum('Ⅲ'), 'III');
  assert.equal(normalizeAlnum('ⅳ'), 'iv');
  assert.equal(normalizeAlnum('３６１'), '361');
  assert.equal(normalizeAlnum('合谷'), '合谷'); // かな・漢字はそのまま
});

test('alnumItemsNormalizeCorrectly: 英数字混じり項目が正規化されてからA〜Z判定される', () => {
  assert.equal(readingInfo('ＷＨＯ').group, '英字');
  assert.equal(readingInfo('ＷＨＯ').reading, 'who');
  assert.equal(readingInfo('Ⅰ型').group, '英字');
  assert.equal(readingInfo('Ⅰ型').reading.startsWith('i'), true);
});

test('sortsInGojuonOrder: 索引は あ〜ん → A〜Z → その他 の順で並ぶ', () => {
  const idx = buildKanaIndex(['わ', 'あ', 'Zebra', '未知の漢字語のみ']);
  const labels = idx.map((s) => s.label);
  assert.deepEqual(labels, ['あ', 'わ', 'A〜Z', '漢字・その他']);
});

test('numbersSortByReading: 数字は見た目の数字順ではなく読みで振り分けられる', () => {
  // 20（にじゅう→な行）と361（さんびゃく…→さ行）は見た目の数字順だと20が先だが、
  // 読みで振り分けるとさ行(361)の方がな行(20)より前に来る
  const idx = buildKanaIndex(['20', '361']);
  const labels = idx.map((s) => s.label);
  assert.ok(labels.indexOf('さ') < labels.indexOf('な'));
});

test('missingReadingFallsToOther: strictモードでは読みが無い項目は必ずその他へ落ちる', () => {
  // 非strict（既定）では先頭がかなの生の文字列がそのまま読み扱いになり「あ」行に入るが、
  // strictモードでは読み（reading）が明示されていない限り必ず「その他」へ落とす
  const lenient = readingInfo('あ行から始まる未登録語', {});
  assert.equal(lenient.group, 'あ');
  const strict = readingInfo('あ行から始まる未登録語', {}, { strict: true });
  assert.equal(strict.group, '漢字');
  assert.equal(strict.type, 'other');
  // 数字・英数字混じりは読みが無くても機械的に読めるのでstrictでも例外
  assert.equal(readingInfo('361', {}, { strict: true }).group, 'さ');
  assert.equal(readingInfo('WHO', {}, { strict: true }).group, '英字');
});

test('otherRowCountDoesNotIncrease: warnOtherThresholdは落ちずに動作する（値の検証はtoc.test.mjs側）', () => {
  assert.doesNotThrow(() => {
    buildKanaIndex(['未知1', '未知2', '未知3'], {}, { strict: true, warnOtherThreshold: 1 });
  });
});
