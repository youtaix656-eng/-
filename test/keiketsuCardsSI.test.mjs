import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints } from '../src/data/knowledgeBase.js';

const SI_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '手の太陽小腸経');

test('手の太陽小腸経19穴がすべて収録され、SI1〜SI19の連番で重複が無い', () => {
  assert.equal(SI_CARDS.length, 19);
  const ryakus = SI_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 19 }, (_, i) => `SI${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 19, 'ryakuの重複');
  assert.equal(new Set(SI_CARDS.map((c) => c.name)).size, 19, '経穴名の重複');
});

test('小腸経19穴はすべて新規追加（既存の仮サンプルカードとの重複が無い）', () => {
  SI_CARDS.forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-si'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('SIの原穴（腕骨）はknowledgeBase.jsのyuanPoints.SIと一致する', () => {
  const byRyaku = Object.fromEntries(SI_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.SI4.name, yuanPoints.SI);
});

test('小海（SI8・小腸経）と少海（HT3・心経）は同音異字の別穴（knowledgeBase.jsのconfusablesと同じ組）で、混同していない', () => {
  const shokai = SI_CARDS.find((c) => c.ryaku === 'SI8');
  assert.equal(shokai.name, '小海');
  assert.ok(shokai.type.includes('小腸経'));
  const htShokai = KEIKETSU_CARDS.find((c) => c.ryaku === 'HT3');
  assert.equal(htShokai.name, '少海');
  assert.ok(htShokai.type.includes('心経'));
});

test('KEIKETSU_CARDS全体: 総数178枚でid・nameが重複しない', () => {
  assert.equal(KEIKETSU_CARDS.length, 178);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
