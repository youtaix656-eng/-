import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEIZETSU_INDEX } from '../src/data/keizetsuIndex.js';
import { resolveKeizetsuTerm, dedupeKeizetsuIndex, bareKeizetsuTerm } from '../src/lib/keizetsuLookup.js';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';

test('KEIZETSU_INDEX: 全項目が term/reading/pages を備える', () => {
  assert.ok(KEIZETSU_INDEX.length > 100, '索引が極端に少ない');
  KEIZETSU_INDEX.forEach((e) => {
    assert.ok(e.term && e.term.length > 0, 'termが空');
    assert.ok(e.reading && /^[ぁ-んー（）]+$/.test(e.reading), `readingがひらがなでない: ${e.term}`);
    assert.ok(Array.isArray(e.pages) && e.pages.length > 0, `pagesが空: ${e.term}`);
    e.pages.forEach((p) => assert.ok(Number.isInteger(p) && p > 0, `pageが不正: ${e.term}`));
  });
});

test('dedupeKeizetsuIndex: 同じtermはページ番号を和集合にしてまとめる', () => {
  const list = [
    { term: '至陰', reading: 'しいん', pages: [13, 148] },
    { term: '至陰', reading: 'しいん', pages: [148, 200] },
    { term: '合谷', reading: 'ごうこく', pages: [12, 138] },
  ];
  const deduped = dedupeKeizetsuIndex(list);
  assert.equal(deduped.length, 2);
  const shiin = deduped.find((e) => e.term === '至陰');
  assert.deepEqual(shiin.pages.sort((a, b) => a - b), [13, 148, 200]);
});

test('dedupeKeizetsuIndex: 実データに重複があっても件数が減る（重複が無いことは主張しない）', () => {
  const deduped = dedupeKeizetsuIndex(KEIZETSU_INDEX);
  assert.ok(deduped.length <= KEIZETSU_INDEX.length);
  assert.equal(new Set(deduped.map((e) => e.term)).size, deduped.length);
});

test('bareKeizetsuTerm: 括弧の別名表記を取り除く', () => {
  assert.equal(bareKeizetsuTerm('犢鼻（外膝眼）'), '犢鼻');
  assert.equal(bareKeizetsuTerm('帯脈（奇経八脈）'), '帯脈');
  assert.equal(bareKeizetsuTerm('合谷'), '合谷');
});

test('resolveKeizetsuTerm: フラッシュカードのある経穴はkind=cardでカード本体を返す', () => {
  const r = resolveKeizetsuTerm('合谷');
  assert.equal(r.kind, 'card');
  assert.equal(r.card, KEIKETSU_CARDS.find((c) => c.name === '合谷'));
});

test('resolveKeizetsuTerm: 十二原穴はkind=pointで経絡名まで解決する', () => {
  // 太淵・衝陽・神門・太谿・大陵・陽池はkeiketsuCards.jsにフラッシュカードとして
  // 追加済みのため、ここではまだカード化されていない原穴（丘墟＝足の少陽胆経）で確認する。
  const r = resolveKeizetsuTerm('丘墟');
  assert.equal(r.kind, 'point');
  assert.ok(r.roles.some((x) => x.meridian === 'GB' && x.role === '原穴' && x.meridianName === '足の少陽胆経'));
});

test('resolveKeizetsuTerm: 経絡そのものはkind=meridian、督脈・任脈も解決できる', () => {
  const lu = resolveKeizetsuTerm('手の太陰肺経');
  assert.equal(lu.kind, 'meridian');
  assert.equal(lu.meridian.id, 'LU');

  const gv = resolveKeizetsuTerm('督脈');
  assert.equal(gv.kind, 'meridian');
  assert.equal(gv.meridian.id, 'GV');

  const cv = resolveKeizetsuTerm('任脈');
  assert.equal(cv.kind, 'meridian');
  assert.equal(cv.meridian.id, 'CV');
});

test('resolveKeizetsuTerm: 独自経穴を持たない奇経はkind=extra', () => {
  const r = resolveKeizetsuTerm('衝脈');
  assert.equal(r.kind, 'extra');
  assert.equal(r.extra.id, 'chong');
});

test('resolveKeizetsuTerm: 紛らわしい経穴の対はkind=confusable', () => {
  // 少海・陽綱はkeiketsuCards.jsにフラッシュカードとして追加済みのため、ここでは
  // 対の相手（懸釐＝足の少陽胆経、まだカード化されていない）で確認する。
  // resolveKeizetsuTermは問い合わせた語（懸釐）自体の状態で解決するため、対の反対側
  // （建里）が既にカード化されていても、懸釐自身が未収録なら引き続きconfusableになる。
  const r = resolveKeizetsuTerm('懸釐');
  assert.equal(r.kind, 'confusable');
  assert.ok(r.confusable.a === '懸釐' || r.confusable.b === '懸釐');
});

test('resolveKeizetsuTerm: 未収録の項目は正直にkind=noneを返す（捏造しない）', () => {
  const r = resolveKeizetsuTerm('存在しない架空の語XYZ');
  assert.equal(r.kind, 'none');
});

test('resolveKeizetsuTerm: 索引の実データを全件解決してもエラーにならない', () => {
  const kinds = new Set();
  dedupeKeizetsuIndex(KEIZETSU_INDEX).forEach((e) => {
    const r = resolveKeizetsuTerm(e.term);
    assert.ok(['card', 'point', 'meridian', 'extra', 'confusable', 'none'].includes(r.kind));
    kinds.add(r.kind);
  });
  // 実データなので少なくとも複数の種類が混在するはず
  assert.ok(kinds.size >= 3);
});
