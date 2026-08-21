import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  numberToKana,
  autoReading,
  kataToHira,
  rowOf,
  readingInfo,
  buildKanaIndex,
  GROUP_ORDER,
  LATIN_GROUP,
} from '../src/lib/yomi.js';

test('numberToKana: 基本の桁', () => {
  assert.equal(numberToKana(0), 'ぜろ');
  assert.equal(numberToKana(1), 'いち');
  assert.equal(numberToKana(10), 'じゅう');
  assert.equal(numberToKana(20), 'にじゅう');
  assert.equal(numberToKana(55), 'ごじゅうご');
  assert.equal(numberToKana(100), 'ひゃく');
  assert.equal(numberToKana(300), 'さんびゃく');
  assert.equal(numberToKana(800), 'はっぴゃく');
  assert.equal(numberToKana(1000), 'せん');
  assert.equal(numberToKana(3000), 'さんぜん');
  assert.equal(numberToKana(2019), 'にせんじゅうきゅう');
  assert.equal(numberToKana(12345), 'いちまんにせんさんびゃくよんじゅうご');
});

test('autoReading: 文字列中の数字を読みに変換する（全角も可）', () => {
  assert.equal(autoReading('20歳未満の方'), 'にじゅう歳未満の方');
  assert.equal(autoReading('２０歳未満の方'), 'にじゅう歳未満の方');
  assert.equal(autoReading('第17条'), '第じゅうなな条');
  assert.equal(autoReading('しびれ'), 'しびれ');
});

test('数字で始まる項目は読み方で五十音に振り分けられる（20→に→な行）', () => {
  assert.equal(readingInfo('20歳未満の方').group, 'な');
  assert.equal(readingInfo('55歳以上').group, 'か'); // ごじゅうご → か行
  assert.equal(readingInfo('1回目').group, 'あ'); // いち → あ行
  assert.equal(readingInfo('300単位').group, 'さ'); // さんびゃく → さ行
});

test('rowOf: 濁点・半濁点・小書きも正しい行に寄せる', () => {
  assert.equal(rowOf('が'), 'か');
  assert.equal(rowOf('じ'), 'さ');
  assert.equal(rowOf('ぱ'), 'は');
  assert.equal(rowOf('ょ'), 'や');
  assert.equal(rowOf('ん'), 'わ');
  assert.equal(rowOf('腰'), null);
});

test('kataToHira: カタカナ読みもかな行に入る', () => {
  assert.equal(kataToHira('ステロイド'), 'すてろいど');
  assert.equal(readingInfo('セラピスト', 'せらぴすと').group, 'さ');
});

test('アルファベットで始まる項目は A〜Z の枠へ', () => {
  assert.equal(readingInfo('NICE NG59').group, LATIN_GROUP);
  assert.equal(readingInfo('WHO ガイドライン').group, LATIN_GROUP);
});

test('reading を明示すればそちらが優先される', () => {
  assert.equal(readingInfo('膀胱直腸障害', 'ぼうこうちょくちょうしょうがい').group, 'は');
  assert.equal(readingInfo('膀胱直腸障害').group, 'その他'); // 読みが無ければ「その他」に落ちる
});

test('buildKanaIndex: あ〜わ → A〜Z の順に並び、空のセクションは作らない', () => {
  const items = [
    { title: 'わかる', reading: 'わかる' },
    { title: 'NICE', reading: '' },
    { title: 'あんない', reading: 'あんない' },
    { title: 'いちらん', reading: 'いちらん' },
  ];
  const sections = buildKanaIndex(items);
  assert.deepEqual(sections.map((s) => s.group), ['あ', 'わ', 'A〜Z']);
  // 同じ行の中は読み順
  assert.deepEqual(sections[0].items.map((i) => i.title), ['あんない', 'いちらん']);
  const order = sections.map((s) => GROUP_ORDER.indexOf(s.group));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('buildKanaIndex: 空配列でも落ちない', () => {
  assert.deepEqual(buildKanaIndex([]), []);
});
