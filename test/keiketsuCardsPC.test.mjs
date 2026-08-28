import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints, luoPoints, xiPoints, muPoints } from '../src/data/knowledgeBase.js';

const PC_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '手の厥陰心包経');

test('手の厥陰心包経9穴がすべて収録され、PC1〜PC9の連番で重複が無い', () => {
  assert.equal(PC_CARDS.length, 9);
  const ryakus = PC_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 9 }, (_, i) => `PC${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 9, 'ryakuの重複');
  assert.equal(new Set(PC_CARDS.map((c) => c.name)).size, 9, '経穴名の重複');
});

test('心包経9穴はすべて新規追加（既存の仮サンプルカードとの重複が無い）', () => {
  PC_CARDS.forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-pc'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('PCの要穴（原穴・絡穴・郄穴・合水穴）はknowledgeBase.jsと一致する', () => {
  const byRyaku = Object.fromEntries(PC_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.PC7.name, yuanPoints.PC); // 大陵＝原穴
  assert.equal(byRyaku.PC6.name, luoPoints.PC); // 内関＝絡穴
  assert.equal(byRyaku.PC4.name, xiPoints.PC); // 郄門＝郄穴
  assert.equal(byRyaku.PC3.name, '曲沢'); // 合水穴
});

test('膻中（心包の募穴）は任脈側のカード（CV17）にあり、PCカードには含まれない', () => {
  assert.ok(!PC_CARDS.some((c) => c.name === '膻中'));
  assert.equal(muPoints.PC, '膻中');
  const cv17 = KEIKETSU_CARDS.find((c) => c.ryaku === 'CV17');
  assert.equal(cv17.name, '膻中');
});

test('内関（PC6）は外関（TE5）と対になる八脈交会穴で、両方ともカード化済み', () => {
  const naikan = PC_CARDS.find((c) => c.ryaku === 'PC6');
  assert.equal(naikan.name, '内関');
  const gaikan = KEIKETSU_CARDS.find((c) => c.ryaku === 'TE5');
  assert.equal(gaikan.name, '外関');
});

test('KEIKETSU_CARDS全体でid・nameが重複しない', () => {
  // 総数は経脈を追加するたびに増えるため、ここでは重複の無さだけを確認する
  // （正確な総数はkeiketsuCardsTE.test.mjs等、最新バッチのテストで確認する）。
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
