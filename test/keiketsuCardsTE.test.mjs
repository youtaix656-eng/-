import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints, luoPoints, xiPoints, muPoints } from '../src/data/knowledgeBase.js';

const TE_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '手の少陽三焦経');

test('手の少陽三焦経23穴がすべて収録され、TE1〜TE23の連番で重複が無い', () => {
  assert.equal(TE_CARDS.length, 23);
  const ryakus = TE_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 23 }, (_, i) => `TE${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 23, 'ryakuの重複');
  assert.equal(new Set(TE_CARDS.map((c) => c.name)).size, 23, '経穴名の重複');
});

test('三焦経23穴はすべて新規追加（既存の仮サンプルカードとの重複が無い）', () => {
  TE_CARDS.forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-te'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('TEの要穴（原穴・絡穴・郄穴）はknowledgeBase.jsと一致する', () => {
  const byRyaku = Object.fromEntries(TE_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.TE4.name, yuanPoints.TE); // 陽池＝原穴
  assert.equal(byRyaku.TE5.name, luoPoints.TE); // 外関＝絡穴
  assert.equal(byRyaku.TE7.name, xiPoints.TE); // 会宗＝郄穴
});

test('石門（三焦の募穴）は任脈側のカード（CV5）にあり、TEカードには含まれない', () => {
  assert.ok(!TE_CARDS.some((c) => c.name === '石門'));
  assert.equal(muPoints.TE, '石門');
  const cv5 = KEIKETSU_CARDS.find((c) => c.ryaku === 'CV5');
  assert.equal(cv5.name, '石門');
});

test('顴髎（SI18・小腸経）と肩髎（TE14・三焦経）は既存のconfusablesの組で、混同していない', () => {
  const kenryo = TE_CARDS.find((c) => c.ryaku === 'TE14');
  assert.equal(kenryo.name, '肩髎');
  const kanryo = KEIKETSU_CARDS.find((c) => c.ryaku === 'SI18');
  assert.equal(kanryo.name, '顴髎');
});

test('KEIKETSU_CARDS全体でid・nameが重複しない', () => {
  // 総数は経脈を追加するたびに増えるため、ここでは重複の無さだけを確認する
  // （正確な総数はkeiketsuCardsLR.test.mjs、361穴完全収録時点の最終テストで確認する）。
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
