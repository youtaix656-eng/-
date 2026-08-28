import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints, luoPoints, xiPoints, muPoints, muPointLocation } from '../src/data/knowledgeBase.js';

const GB_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '足の少陽胆経');

test('足の少陽胆経44穴がすべて収録され、GB1〜GB44の連番で重複が無い', () => {
  assert.equal(GB_CARDS.length, 44);
  const ryakus = GB_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 44 }, (_, i) => `GB${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 44, 'ryakuの重複');
  assert.equal(new Set(GB_CARDS.map((c) => c.name)).size, 44, '経穴名の重複');
});

test('胆経44穴はすべて新規追加（既存の仮サンプルカードとの重複が無い）', () => {
  GB_CARDS.forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-gb'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('GBの要穴（原穴・絡穴・郄穴）はknowledgeBase.jsと一致する', () => {
  const byRyaku = Object.fromEntries(GB_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.GB40.name, yuanPoints.GB); // 丘墟＝原穴
  assert.equal(byRyaku.GB37.name, luoPoints.GB); // 光明＝絡穴
  assert.equal(byRyaku.GB36.name, xiPoints.GB); // 外丘＝郄穴
});

test('日月（GB24）は胆の募穴で自経上、京門（GB25）は腎の募穴で、muPointLocation.KI=GBと整合する', () => {
  const byRyaku = Object.fromEntries(GB_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.GB24.name, muPoints.GB);
  assert.ok(byRyaku.GB24.type.includes('募穴'));
  assert.equal(byRyaku.GB25.name, muPoints.KI);
  assert.equal(muPointLocation.KI, 'GB');
});

test('陽陵泉（GB34）は合土穴・八会穴の筋会・下合穴を兼ね、懸鍾（GB39）は八会穴の髄会', () => {
  const byRyaku = Object.fromEntries(GB_CARDS.map((c) => [c.ryaku, c]));
  assert.ok(byRyaku.GB34.type.includes('筋会'));
  assert.ok(byRyaku.GB34.type.includes('下合穴'));
  assert.ok(byRyaku.GB39.type.includes('髄会'));
});

test('KEIKETSU_CARDS全体でid・nameが重複しない', () => {
  // 総数は経脈を追加するたびに増えるため、ここでは重複の無さだけを確認する
  // （正確な総数はkeiketsuCardsLR.test.mjs、361穴完全収録時点の最終テストで確認する）。
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
