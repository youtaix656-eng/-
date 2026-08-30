import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints, luoPoints, xiPoints, muPoints } from '../src/data/knowledgeBase.js';

const KI_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '足の少陰腎経');

test('足の少陰腎経27穴がすべて収録され、KI1〜KI27の連番で重複が無い', () => {
  assert.equal(KI_CARDS.length, 27);
  const ryakus = KI_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 27 }, (_, i) => `KI${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 27, 'ryakuの重複');
  assert.equal(new Set(KI_CARDS.map((c) => c.name)).size, 27, '経穴名の重複');
});

test('腎経27穴はすべて新規追加（既存の仮サンプルカードとの重複が無い）', () => {
  KI_CARDS.forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-ki'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('KIの要穴（原穴・絡穴・郄穴）はknowledgeBase.jsと一致する', () => {
  const byRyaku = Object.fromEntries(KI_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.KI3.name, yuanPoints.KI); // 太谿＝原穴
  assert.equal(byRyaku.KI4.name, luoPoints.KI); // 大鍾＝絡穴
  assert.equal(byRyaku.KI5.name, xiPoints.KI); // 水泉＝郄穴
});

test('京門（腎の募穴）は足の少陽胆経上（GB25）にあり、KIカードには含まれない', () => {
  assert.ok(!KI_CARDS.some((c) => c.name === '京門'));
  assert.equal(muPoints.KI, '京門');
});

test('照海（KI6）は八脈交会穴で申脈（BL62）と対になる。両方ともカード化済み', () => {
  const shokai = KI_CARDS.find((c) => c.ryaku === 'KI6');
  assert.equal(shokai.name, '照海');
  const shinmyaku = KEIKETSU_CARDS.find((c) => c.ryaku === 'BL62');
  assert.equal(shinmyaku.name, '申脈');
});

test('KEIKETSU_CARDS全体でid・nameが重複しない', () => {
  // 総数は経脈を追加するたびに増えるため、ここでは重複の無さだけを確認する
  // （正確な総数はkeiketsuCardsTE.test.mjs等、最新バッチのテストで確認する）。
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
