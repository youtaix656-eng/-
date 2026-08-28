import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { yuanPoints, luoPoints, xiPoints, extraMeridianPoints, dualDefinitionPoints } from '../src/data/knowledgeBase.js';

const LI_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '手の陽明大腸経');

test('手の陽明大腸経20穴がすべて収録され、LI1〜LI20の連番で重複が無い（合谷・曲池は既存カードと共有）', () => {
  assert.equal(LI_CARDS.length, 20);
  const ryakus = LI_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 20 }, (_, i) => `LI${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 20, 'ryakuの重複');
  assert.equal(new Set(LI_CARDS.map((c) => c.name)).size, 20, '経穴名の重複');
});

test('合谷（LI4）・曲池（LI11）は既存の仮サンプルカードを流用し、新規重複カードを作っていない', () => {
  const goukoku = LI_CARDS.find((c) => c.ryaku === 'LI4');
  const kyokuchi = LI_CARDS.find((c) => c.ryaku === 'LI11');
  assert.equal(goukoku.id, 'kc-goukoku');
  assert.equal(kyokuchi.id, 'kc-kyokuchi');
});

test('新規追加した18穴（LI4・LI11以外）は id・yomi・location を備え、shujiはnull', () => {
  LI_CARDS.filter((c) => c.ryaku !== 'LI4' && c.ryaku !== 'LI11').forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-li'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('LIの要穴（原穴・絡穴・郄穴）はknowledgeBase.jsと一致する', () => {
  const byRyaku = Object.fromEntries(LI_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.LI4.name, yuanPoints.LI); // 合谷＝原穴
  assert.equal(byRyaku.LI6.name, luoPoints.LI); // 偏歴＝絡穴
  assert.equal(byRyaku.LI7.name, xiPoints.LI); // 温溜＝郄穴
});

test('肩髃（LI15）・巨骨（LI16）は陽蹻脈の借穴としてknowledgeBase.jsのextraMeridianPointsと整合する', () => {
  const byRyaku = Object.fromEntries(LI_CARDS.map((c) => [c.ryaku, c]));
  const yangqiao = extraMeridianPoints.find((e) => e.id === 'yangqiao');
  assert.ok(yangqiao.points.includes('肩髃'));
  assert.ok(yangqiao.points.includes('巨骨'));
  assert.ok(byRyaku.LI15.type.includes('陽蹻脈'));
  assert.ok(byRyaku.LI16.type.includes('陽蹻脈'));
});

test('禾髎（LI19）・迎香（LI20）はknowledgeBase.jsのdualDefinitionPoints（別説あり6穴）と整合する', () => {
  const byRyaku = Object.fromEntries(LI_CARDS.map((c) => [c.ryaku, c]));
  assert.ok(byRyaku.LI19.type.includes('別説'));
  assert.ok(byRyaku.LI20.type.includes('別説'));
  assert.ok(dualDefinitionPoints.includes('禾髎'));
  assert.ok(dualDefinitionPoints.includes('迎香'));
});

test('既存の仮サンプルカード（合谷・足三里・曲池・三陰交・太衝）の経絡表記は' +
  'knowledgeBase.jsのmeridians（「手の」「足の」を含む正式名称）に統一されている', () => {
  const officialNames = ['手の陽明大腸経', '足の陽明胃経', '足の太陰脾経', '足の厥陰肝経'];
  const sampleCards = KEIKETSU_CARDS.filter((c) =>
    ['合谷', '足三里', '曲池', '三陰交', '太衝'].includes(c.name)
  );
  sampleCards.forEach((c) => {
    assert.ok(
      officialNames.includes(c.meridian) || c.meridian === '足の厥陰肝経',
      `${c.name}: meridianが正式名称でない（${c.meridian}）`
    );
    assert.ok(!/^(手|足)[^の]/.test(c.meridian), `${c.name}: 「手」「足」の直後に「の」が無い旧表記のまま（${c.meridian}）`);
  });
});

test('KEIKETSU_CARDS全体: 総数86枚でid・nameが重複しない', () => {
  assert.equal(KEIKETSU_CARDS.length, 86);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
