import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints, luoPoints, xiPoints, muPoints, muPointLocation, fourCommandPoints } from '../src/data/knowledgeBase.js';

const ST_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '足の陽明胃経');

test('足の陽明胃経45穴がすべて収録され、ST1〜ST45の連番で重複が無い（足三里は既存カードと共有）', () => {
  assert.equal(ST_CARDS.length, 45);
  const ryakus = ST_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 45 }, (_, i) => `ST${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 45, 'ryakuの重複');
  assert.equal(new Set(ST_CARDS.map((c) => c.name)).size, 45, '経穴名の重複');
});

test('足三里（ST36）は既存の仮サンプルカードを流用し、新規重複カードを作っていない', () => {
  const sanri = ST_CARDS.find((c) => c.ryaku === 'ST36');
  assert.equal(sanri.id, 'kc-sanri');
});

test('新規追加した44穴（ST36以外）は id・yomi・location を備え、shujiはnull', () => {
  ST_CARDS.filter((c) => c.ryaku !== 'ST36').forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-st'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('STの要穴（原穴・絡穴・郄穴）はknowledgeBase.jsと一致する', () => {
  const byRyaku = Object.fromEntries(ST_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.ST42.name, yuanPoints.ST); // 衝陽＝原穴
  assert.equal(byRyaku.ST40.name, luoPoints.ST); // 豊隆＝絡穴
  assert.equal(byRyaku.ST34.name, xiPoints.ST); // 梁丘＝郄穴
});

test('天枢（ST25）は大腸の募穴で、knowledgeBase.jsのmuPoints.LI・muPointLocation.LIと整合する', () => {
  const byRyaku = Object.fromEntries(ST_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.ST25.name, muPoints.LI);
  assert.equal(muPointLocation.LI, 'ST'); // 天枢は胃経(ST25)上にある
  assert.ok(byRyaku.ST25.type.includes('募穴'));
});

test('下合穴（上巨虚＝大腸・下巨虚＝小腸・足三里＝胃）はknowledgeBase.jsのfourCommandPointsと矛盾しない', () => {
  const byRyaku = Object.fromEntries(ST_CARDS.map((c) => [c.ryaku, c]));
  assert.ok(byRyaku.ST37.type.includes('下合穴'));
  assert.ok(byRyaku.ST39.type.includes('下合穴'));
  const bellyPoint = fourCommandPoints.find((f) => f.area.includes('腹部'));
  assert.equal(bellyPoint.point, '足三里'); // 四総穴「肚腹は三里」＝ST36そのもの
});

test('KEIKETSU_CARDS全体: 総数130枚でid・nameが重複しない', () => {
  assert.equal(KEIKETSU_CARDS.length, 130);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
