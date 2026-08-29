import test from 'node:test';
import assert from 'node:assert/strict';

import { HACKS } from '../src/data/hacks.js';
import {
  normalize, parseQuery, expandTerm, scoreHack, searchHacks, explainNoHits, suggestTerms, highlightParts,
} from '../src/lib/search.js';

const titlesOf = (rows) => rows.map((r) => r.hack.title);

test('正規化は文字数を変えない（変えるとハイライトの位置がずれる）', () => {
  for (const text of ['スマホ', 'ＳＮＳ', 'Coffee', '25分やって5分休む', 'ｶﾀｶﾅ']) {
    assert.equal(normalize(text).length, text.length, text);
  }
});

test('カタカナ・ひらがな・全角半角・大文字小文字の違いで引けなくならない', () => {
  assert.equal(normalize('スマホ'), normalize('すまほ'));
  assert.equal(normalize('ＳＮＳ'), normalize('sns'));
  assert.ok(searchHacks(HACKS, 'すまほ').length > 0);
  assert.equal(searchHacks(HACKS, 'すまほ').length, searchHacks(HACKS, 'スマホ').length);
});

test('空白区切りは「かつ」（両方を含むものだけ）', () => {
  const both = searchHacks(HACKS, '睡眠 夜勤');
  const one = searchHacks(HACKS, '睡眠');
  assert.ok(both.length > 0);
  assert.ok(both.length < one.length);
  assert.equal(parseQuery('睡眠　夜勤').terms.length, 2, '全角の空白でも分かれる');
});

test('-語 でその語を含むものを外せる', () => {
  const all = searchHacks(HACKS, '習慣');
  const without = searchHacks(HACKS, '習慣 -スマホ');
  assert.ok(without.length > 0);
  assert.ok(without.length < all.length);
  for (const row of without) assert.ok(!JSON.stringify(row.hack).includes('スマホ'));
});

test('困っている時の言葉（言い換え）から引ける — これが引けないと検索は失敗する', () => {
  const cases = [
    ['ねむれない', 'sleep'],
    ['やる気が出ない', 'focus'],
    ['三日坊主', 'habit'],
    ['イライラ', 'mind'],
    ['捨てられない', 'tidy'],
    ['むだづかい', 'money'],
    ['あかない', 'home'],
  ];
  for (const [word, category] of cases) {
    const rows = searchHacks(HACKS, word);
    assert.ok(rows.length > 0, `「${word}」で0件`);
    assert.ok(rows.some((r) => r.hack.category === category), `「${word}」で ${category} が出ない`);
  }
});

test('言い換えで当たったことが分かる（本人が書いた語より弱く見る）', () => {
  const rows = searchHacks(HACKS, 'ねむれない');
  assert.ok(rows.some((r) => r.usedSynonym));
  assert.deepEqual(expandTerm('').length, 0);
  assert.ok(expandTerm('ねむれない').includes('睡眠'));
});

test('題名に入っているものが、説明の中にあるだけのものより上に来る', () => {
  const rows = searchHacks(HACKS, '通知');
  assert.ok(rows.length > 1);
  assert.match(rows[0].hack.title, /通知/);
});

test('1語も当たらないものは出さない（「たぶん近い」を混ぜない）', () => {
  const rows = searchHacks(HACKS, 'ぜったいにないことば');
  assert.equal(rows.length, 0);
  assert.equal(scoreHack(HACKS[0], 'ぜったいにないことば').score, 0);
});

test('検索語が空なら、絞り込みだけを掛けた全件を返す', () => {
  assert.equal(searchHacks(HACKS, '').length, HACKS.length);
  const only = searchHacks(HACKS, '', { categories: ['sleep'] });
  assert.ok(only.length > 0);
  for (const row of only) assert.equal(row.hack.category, 'sleep');
});

test('手軽さの絞り込みは検索語と一緒に効く', () => {
  const rows = searchHacks(HACKS, '習慣', { effortMax: 1 });
  for (const row of rows) assert.ok(row.hack.effort <= 1);
});

test('0件のときに行き止まりにしない（どの語を外せば何件か）', () => {
  const query = '睡眠 現金';
  assert.equal(searchHacks(HACKS, query).length, 0);
  const hint = explainNoHits(HACKS, query);
  assert.ok(hint.dropOne.length > 0);
  assert.ok(hint.dropOne[0].count > 0);
  assert.ok(hint.alone.every((a) => typeof a.count === 'number'));
});

test('語が1つだけの0件では、外す案は出さない（外すと全件になるだけ）', () => {
  const hint = explainNoHits(HACKS, 'ぜったいにないことば');
  assert.deepEqual(hint.dropOne, []);
  assert.equal(hint.alone[0].count, 0);
});

test('候補は0件になる語を出さない・入力そのものは出さない', () => {
  const list = suggestTerms(HACKS, 'す');
  assert.ok(list.length > 0);
  for (const word of list) assert.ok(searchHacks(HACKS, word).length > 0, `候補「${word}」が0件`);
  assert.ok(!suggestTerms(HACKS, '睡眠').includes('睡眠'));
  assert.deepEqual(suggestTerms(HACKS, '   '), []);
});

test('色付けは元の文章をそのまま復元できる', () => {
  const text = '寝る前にスマホを見る時間を短くする';
  const parts = highlightParts(text, 'すまほ');
  assert.equal(parts.map((p) => p.text).join(''), text);
  assert.ok(parts.some((p) => p.hit && p.text === 'スマホ'));
  assert.deepEqual(highlightParts(text, ''), [{ text, hit: false }]);
});

test('色付けは言い換えの語にも付く（当たった理由が見える）', () => {
  const parts = highlightParts('眠れない時は一度ベッドから出る', 'ねむれない');
  assert.ok(parts.some((p) => p.hit && p.text.includes('眠れない')));
});

test('瓶の蓋は、その場で出てくる言い方どれでも引ける（ふた・キャップ・あかない・ジャム）', () => {
  const ids = new Set(searchHacks(HACKS, '瓶の蓋').map((r) => r.hack.id));
  assert.ok(ids.size >= 5);
  for (const word of ['あかない', 'ふた', 'キャップ', 'ジャム', '固い', '握力']) {
    const rows = searchHacks(HACKS, word);
    assert.ok(rows.length > 0, `「${word}」で0件`);
    assert.ok(rows.some((r) => ids.has(r.hack.id)), `「${word}」で瓶の蓋の項目が出ない`);
  }
});

test('危ないことの言葉（割れる・やけど・破片）からも引ける', () => {
  for (const word of ['やけど', '破片', '割れ']) {
    const rows = searchHacks(HACKS, word);
    assert.ok(rows.length > 0, `「${word}」で0件`);
  }
});
