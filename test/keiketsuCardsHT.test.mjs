import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints, luoPoints, xiPoints, muPoints } from '../src/data/knowledgeBase.js';

const HT_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '手の少陰心経');

test('手の少陰心経9穴がすべて収録され、HT1〜HT9の連番で重複が無い', () => {
  assert.equal(HT_CARDS.length, 9);
  const ryakus = HT_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 9 }, (_, i) => `HT${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 9, 'ryakuの重複');
  assert.equal(new Set(HT_CARDS.map((c) => c.name)).size, 9, '経穴名の重複');
});

test('心経9穴はすべて新規追加（既存の仮サンプルカードとの重複が無い）', () => {
  HT_CARDS.forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-ht'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('HTの要穴（原穴・絡穴・郄穴・合水穴）はknowledgeBase.jsと一致する', () => {
  const byRyaku = Object.fromEntries(HT_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.HT7.name, yuanPoints.HT); // 神門＝原穴
  assert.equal(byRyaku.HT5.name, luoPoints.HT); // 通里＝絡穴
  assert.equal(byRyaku.HT6.name, xiPoints.HT); // 陰郄＝郄穴
  assert.equal(byRyaku.HT3.name, '少海'); // 合水穴
});

test('巨闕（心の募穴）は任脈側のカード（CV14）にあり、HTカードには含まれない', () => {
  assert.ok(!HT_CARDS.some((c) => c.name === '巨闕'));
  assert.equal(muPoints.HT, '巨闕');
  const cv14 = KEIKETSU_CARDS.find((c) => c.ryaku === 'CV14');
  assert.equal(cv14.name, '巨闕');
});

test('KEIKETSU_CARDS全体でid・nameが重複しない', () => {
  // 総数は経脈を追加するたびに増えるため、ここでは重複の無さだけを確認する
  // （正確な総数はkeiketsuCardsSI.test.mjs等、最新バッチのテストで確認する）。
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
