import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { luoPoints, muPoints, muPointLocation } from '../src/data/knowledgeBase.js';

const CV_CARDS = KEIKETSU_CARDS.filter((c) => c.meridian === '任脈');

test('任脈24穴がすべて収録され、CV1〜CV24の連番で重複が無い', () => {
  assert.equal(CV_CARDS.length, 24);
  const ryakus = CV_CARDS.map((c) => c.ryaku);
  const expected = Array.from({ length: 24 }, (_, i) => `CV${i + 1}`);
  assert.deepEqual([...ryakus].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))), expected);
  assert.equal(new Set(ryakus).size, 24, 'ryakuの重複');
  assert.equal(new Set(CV_CARDS.map((c) => c.name)).size, 24, '経穴名の重複');
  assert.equal(new Set(CV_CARDS.map((c) => c.id)).size, 24, 'idの重複');
});

test('任脈の各カードは id・yomi・location を備え、shujiは本書に記載が無いためnull', () => {
  CV_CARDS.forEach((c) => {
    assert.ok(c.id && c.id.startsWith('kc-cv'), `${c.name}: idの命名規則`);
    assert.ok(c.yomi && c.yomi.length > 0, `${c.name}: yomiが空`);
    assert.ok(c.location && c.location.length > 5, `${c.name}: locationが短すぎる`);
    assert.equal(c.shuji, null, `${c.name}: shujiは教科書に記載が無いためnullであるべき`);
  });
});

test('任脈上の募穴（中極・関元・石門・中脘・巨闕・膻中）はknowledgeBase.jsのmuPointsと一致する', () => {
  const byRyaku = Object.fromEntries(CV_CARDS.map((c) => [c.ryaku, c]));
  assert.equal(byRyaku.CV3.name, muPoints.BL); // 中極＝膀胱の募穴
  assert.equal(byRyaku.CV4.name, muPoints.SI); // 関元＝小腸の募穴
  assert.equal(byRyaku.CV5.name, muPoints.TE); // 石門＝三焦の募穴
  assert.equal(byRyaku.CV12.name, muPoints.ST); // 中脘＝胃の募穴
  assert.equal(byRyaku.CV14.name, muPoints.HT); // 巨闕＝心の募穴
  assert.equal(byRyaku.CV17.name, muPoints.PC); // 膻中＝心包の募穴
  [byRyaku.CV3, byRyaku.CV4, byRyaku.CV5, byRyaku.CV12, byRyaku.CV14, byRyaku.CV17].forEach((c) => {
    assert.ok(c.type && c.type.includes('募穴'), `${c.name}: typeに募穴の記載が無い`);
  });
});

test('鳩尾（CV15）は任脈の絡穴でknowledgeBase.jsのluoPoints.CVと一致する', () => {
  const kyuubi = CV_CARDS.find((c) => c.ryaku === 'CV15');
  assert.equal(kyuubi.name, '鳩尾');
  assert.equal(kyuubi.type, '任脈の絡穴');
  assert.equal(luoPoints.CV, '鳩尾');
});

test('muPointLocation: 天枢（大腸募）は任脈24穴に含まれないため胃経(ST)上、章門（脾募）は肝経(LR)上', () => {
  // 任脈24穴を実際に確認した結果、天枢はここに含まれない（天枢はST25）ことが分かったための回帰テスト。
  assert.ok(!CV_CARDS.some((c) => c.name === '天枢'), '天枢は任脈の経穴ではない');
  assert.equal(muPointLocation.LI, 'ST');
  assert.equal(muPointLocation.SP, 'LR');
  // 自経上（募穴が臓腑自身の経絡上にある）のは中府(LU)・日月(GB)・期門(LR)の3つだけ
  const selfCount = Object.values(muPointLocation).filter((v) => v === 'self').length;
  assert.equal(selfCount, 3);
});

test('KEIKETSU_CARDS全体でid・nameが重複しない（既存5枚＋督脈28穴＋任脈24穴）', () => {
  assert.equal(KEIKETSU_CARDS.length, 57);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.id)).size, KEIKETSU_CARDS.length);
  assert.equal(new Set(KEIKETSU_CARDS.map((c) => c.name)).size, KEIKETSU_CARDS.length);
});
