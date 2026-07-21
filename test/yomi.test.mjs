import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberToKana, readingInfo, buildKanaIndex } from '../src/lib/yomi.js';

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
