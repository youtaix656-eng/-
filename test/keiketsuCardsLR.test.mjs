import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints, luoPoints, xiPoints, muPoints, muPointLocation } from '../src/data/knowledgeBase.js';

const LR_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '足の厥陰肝経');

test('足の厥陰肝経14穴がすべて収録され、LR1〜LR14の連番で重複が無い（太衝は既存カードと共有）', () => {
  assert.equal(LR_CARDS.length, 14);
  const ryakus = LR_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 14 }, (_, i) => `LR${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 14, 'ryakuの重複');
  assert.equal(new Set(LR_CARDS.map((c) => c.name)).size, 14, '経穴名の重複');
});

test('太衝（LR3）は既存の仮サンプルカードを流用し、新規重複カードを作っていない', () => {
  const taisho = LR_CARDS.find((c) => c.ryaku === 'LR3');
  assert.equal(taisho.id, 'kc-taisho');
});

test('新規追加した13穴（LR3以外）は id・yomi・location を備え、shujiはnull', () => {
  LR_CARDS.filter((c) => c.ryaku !== 'LR3').forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-lr'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('LRの要穴（原穴・絡穴・郄穴）はknowledgeBase.jsと一致する', () => {
  const byRyaku = Object.fromEntries(LR_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.LR3.name, yuanPoints.LR); // 太衝＝原穴
  assert.equal(byRyaku.LR5.name, luoPoints.LR); // 蠡溝＝絡穴
  assert.equal(byRyaku.LR6.name, xiPoints.LR); // 中都＝郄穴
});

test('期門（LR14）は肝の募穴で自経上、章門（LR13）は脾の募穴・八会穴の臓会で、muPointLocation.SP=LRと整合する', () => {
  const byRyaku = Object.fromEntries(LR_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.LR14.name, muPoints.LR);
  assert.ok(byRyaku.LR14.type.includes('募穴'));
  assert.equal(byRyaku.LR13.name, muPoints.SP);
  assert.ok(byRyaku.LR13.type.includes('臓会'));
  assert.equal(muPointLocation.SP, 'LR');
});

test('KEIKETSU_CARDS全体: 361穴を完全収録、id・nameが重複しない', () => {
  assert.equal(KEIKETSU_CARDS.length, 361);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});

test('十四経脈すべての経穴数が教科書どおりである', () => {
  const countOf = (name) => KEIKETSU_CARDS.filter((c) => c.meridian === name).length;
  assert.equal(countOf('督脈'), 28);
  assert.equal(countOf('任脈'), 24);
  assert.equal(countOf('手の太陰肺経'), 11);
  assert.equal(countOf('手の陽明大腸経'), 20);
  assert.equal(countOf('足の陽明胃経'), 45);
  assert.equal(countOf('足の太陰脾経'), 21);
  assert.equal(countOf('手の少陰心経'), 9);
  assert.equal(countOf('手の太陽小腸経'), 19);
  assert.equal(countOf('足の太陽膀胱経'), 67);
  assert.equal(countOf('足の少陰腎経'), 27);
  assert.equal(countOf('手の厥陰心包経'), 9);
  assert.equal(countOf('手の少陽三焦経'), 23);
  assert.equal(countOf('足の少陽胆経'), 44);
  assert.equal(countOf('足の厥陰肝経'), 14);
});
