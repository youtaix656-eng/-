import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints, luoPoints, xiPoints, muPoints, muPointLocation, fourCommandPoints } from '../src/data/knowledgeBase.js';

const LU_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '手の太陰肺経');

test('手の太陰肺経11穴がすべて収録され、LU1〜LU11の連番で重複が無い', () => {
  assert.equal(LU_CARDS.length, 11);
  const ryakus = LU_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 11 }, (_, i) => `LU${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 11, 'ryakuの重複');
  assert.equal(new Set(LU_CARDS.map((c) => c.name)).size, 11, '経穴名の重複');
});

test('手の太陰肺経の各カードは id・yomi・location を備え、shujiは本書に記載が無いためnull', () => {
  LU_CARDS.forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-lu'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('LUの要穴（原穴・絡穴・郄穴・募穴）はknowledgeBase.jsと一致する', () => {
  const byRyaku = Object.fromEntries(LU_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.LU9.name, yuanPoints.LU); // 太淵＝原穴
  assert.equal(byRyaku.LU7.name, luoPoints.LU); // 列欠＝絡穴
  assert.equal(byRyaku.LU6.name, xiPoints.LU); // 孔最＝郄穴
  assert.equal(byRyaku.LU1.name, muPoints.LU); // 中府＝募穴
  assert.equal(muPointLocation.LU, 'self'); // 中府はLU1＝自経上で正しい
  const headNeck = fourCommandPoints.find((f) => f.area.includes('頭項'));
  assert.equal(headNeck.point, byRyaku.LU7.name); // 四総穴「頭項は列欠」
});

test('KEIKETSU_CARDS全体でid・nameが重複しない', () => {
  // 総数は経脈を追加するたびに増えるため、ここでは重複の無さだけを確認する
  // （正確な総数はkeiketsuCardsLI.test.mjs等、最新バッチのテストで確認する）。
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
