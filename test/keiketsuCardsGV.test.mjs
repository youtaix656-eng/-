import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { luoPoints, dualDefinitionPoints } from '../src/data/knowledgeBase.js';

const GV_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '督脈');

test('督脈28穴がすべて収録され、GV1〜GV28の連番で重複が無い', () => {
  assert.equal(GV_CARDS.length, 28);
  const ryakus = GV_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 28 }, (_, i) => `GV${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 28, 'ryakuの重複');
  assert.equal(new Set(GV_CARDS.map((c) => c.name)).size, 28, '経穴名の重複');
  assert.equal(new Set(GV_CARDS.map((c) => c.id)).size, 28, 'idの重複');
});

test('督脈の各カードは id・yomi・location を備え、shujiは本書に記載が無いためnull', () => {
  GV_CARDS.forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-gv'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('督脈の絡穴（長強）はknowledgeBase.jsのluoPointsと一致する', () => {
  const choukyou = GV_CARDS.find((c) => c.ryaku === 'GV1');
  assert.equal(choukyou.name, '長強');
  assert.equal(choukyou.type, '督脈の絡穴');
  assert.equal(luoPoints.GV, '長強');
});

test('水溝（GV26）はknowledgeBase.jsのdualDefinitionPoints（別説あり6穴）と整合する', () => {
  const suikou = GV_CARDS.find((c) => c.ryaku === 'GV26');
  assert.equal(suikou.name, '水溝');
  assert.ok(suikou.type.includes('別説'));
  assert.ok(dualDefinitionPoints.includes('水溝'));
});

test('KEIKETSU_CARDS全体でid・nameが重複しない（既存5枚＋督脈28穴）', () => {
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
