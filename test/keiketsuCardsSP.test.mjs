import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints, luoPoints, xiPoints, muPoints, muPointLocation } from '../src/data/knowledgeBase.js';

const SP_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '足の太陰脾経');

test('足の太陰脾経21穴がすべて収録され、SP1〜SP21の連番で重複が無い（三陰交は既存カードと共有）', () => {
  assert.equal(SP_CARDS.length, 21);
  const ryakus = SP_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 21 }, (_, i) => `SP${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 21, 'ryakuの重複');
  assert.equal(new Set(SP_CARDS.map((c) => c.name)).size, 21, '経穴名の重複');
});

test('三陰交（SP6）は既存の仮サンプルカードを流用し、新規重複カードを作っていない', () => {
  const saninkou = SP_CARDS.find((c) => c.ryaku === 'SP6');
  assert.equal(saninkou.id, 'kc-saninkou');
});

test('新規追加した20穴（SP6以外）は id・yomi・location を備え、shujiはnull', () => {
  SP_CARDS.filter((c) => c.ryaku !== 'SP6').forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-sp'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('SPの要穴（原穴・絡穴・郄穴・合水穴）はknowledgeBase.jsと一致する', () => {
  const byRyaku = Object.fromEntries(SP_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.SP3.name, yuanPoints.SP); // 太白＝原穴
  assert.equal(byRyaku.SP4.name, luoPoints.SP); // 公孫＝絡穴
  assert.equal(byRyaku.SP8.name, xiPoints.SP); // 地機＝郄穴
});

test('大包（SP21）は脾の大絡の絡穴で、knowledgeBase.jsのluoPoints.SP_GREATと一致する', () => {
  const daihou = SP_CARDS.find((c) => c.ryaku === 'SP21');
  assert.equal(daihou.name, luoPoints.SP_GREAT);
  assert.ok(daihou.type.includes('大絡'));
});

test('章門（脾の募穴）はSPカードに含まれない（肝経＝LR上にあるため）。muPointLocation.SPと矛盾しない', () => {
  assert.ok(!SP_CARDS.some((c) => c.name === '章門'));
  assert.equal(muPoints.SP, '章門');
  assert.equal(muPointLocation.SP, 'LR');
});

test('KEIKETSU_CARDS全体でid・nameが重複しない', () => {
  // 総数は経脈を追加するたびに増えるため、ここでは重複の無さだけを確認する
  // （正確な総数はkeiketsuCardsSI.test.mjs等、最新バッチのテストで確認する）。
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
