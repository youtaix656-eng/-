import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints, luoPoints, xiPoints, fourCommandPoints } from '../src/data/knowledgeBase.js';

const BL_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '足の太陽膀胱経');

test('足の太陽膀胱経67穴がすべて収録され、BL1〜BL67の連番で重複が無い', () => {
  assert.equal(BL_CARDS.length, 67);
  const ryakus = BL_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 67 }, (_, i) => `BL${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 67, 'ryakuの重複');
  assert.equal(new Set(BL_CARDS.map((c) => c.name)).size, 67, '経穴名の重複');
});

test('膀胱経67穴はすべて新規追加（既存の仮サンプルカードとの重複が無い）', () => {
  BL_CARDS.forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-bl'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('BLの要穴（原穴・絡穴・郄穴）はknowledgeBase.jsと一致する', () => {
  const byRyaku = Object.fromEntries(BL_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.BL64.name, yuanPoints.BL); // 京骨＝原穴
  assert.equal(byRyaku.BL58.name, luoPoints.BL); // 飛揚＝絡穴
  assert.equal(byRyaku.BL63.name, xiPoints.BL); // 金門＝郄穴
});

test('委中（BL40）は四総穴「腰背は委中」でfourCommandPointsと一致し、下合穴・合土穴の分類も持つ', () => {
  const byRyaku = Object.fromEntries(BL_CARDS.map((c) => [c.ryaku, c]));
  const backPoint = fourCommandPoints.find((f) => f.area.includes('腰背'));
  assert.equal(backPoint.point, '委中');
  assert.equal(byRyaku.BL40.name, '委中');
  assert.ok(byRyaku.BL40.type.includes('下合穴'));
  assert.ok(byRyaku.BL40.type.includes('合土穴'));
});

test('五臓六腑の背部兪穴（肺兪・心兪・肝兪・胆兪・脾兪・胃兪・腎兪・大腸兪・小腸兪・膀胱兪・三焦兪・厥陰兪）が揃っている', () => {
  const names = new Set(BL_CARDS.map((c) => c.name));
  ['肺兪', '心兪', '肝兪', '胆兪', '脾兪', '胃兪', '腎兪', '大腸兪', '小腸兪', '膀胱兪', '三焦兪', '厥陰兪'].forEach((n) => {
    assert.ok(names.has(n), `${n}が見つからない`);
  });
});

test('KEIKETSU_CARDS全体でid・nameが重複しない', () => {
  // 総数は経脈を追加するたびに増えるため、ここでは重複の無さだけを確認する
  // （正確な総数はkeiketsuCardsTE.test.mjs等、最新バッチのテストで確認する）。
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
