import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkedKeywords, mindmapFor, centerCandidates, radialLayout, branchesOf } from '../src/lib/mindmap.js';
import { comparisonsForKeyword, numbersForKeyword } from '../src/data/mindmapData.js';

const Q = [
  { id: 'a', tags: ['合谷', '原穴', '大腸経'] },
  { id: 'b', tags: ['太衝', '原穴', '肝経'] },
  { id: 'c', tags: ['原穴'] },
];
const links = {};

test('linkedKeywords: 共起を多い順に返す', () => {
  const l = linkedKeywords('原穴', Q, links);
  const kws = l.map((x) => x.keyword);
  assert.ok(kws.includes('合谷'));
  assert.ok(kws.includes('大腸経'));
  assert.ok(!kws.includes('原穴')); // 自分は除く
});

test('KBデータ：比較・数値がキーワードで引ける', () => {
  assert.ok(comparisonsForKeyword('原穴').some((c) => c.id === 'yaketsu'));
  assert.ok(numbersForKeyword('原穴').some((n) => n.id === 'n-genketsu'));
  assert.equal(numbersForKeyword('原穴').find((n) => n.id === 'n-genketsu').value, '12');
  assert.ok(comparisonsForKeyword('交感神経').some((c) => c.id === 'jiritsu'));
});

test('mindmapFor: つながり・比較・数値をまとめる', () => {
  const mm = mindmapFor('原穴', Q, links);
  assert.equal(mm.center, '原穴');
  assert.ok(mm.linked.length >= 2);
  assert.ok(mm.comparisons.length >= 1);
  assert.ok(mm.numbers.length >= 1);
});

test('centerCandidates: ユーザー語とおすすめを返す', () => {
  const c = centerCandidates(Q, links);
  assert.ok(c.user.includes('原穴'));
  assert.ok(Array.isArray(c.suggested));
});

test('branchesOf / radialLayout: ブランチに種類と座標が付く', () => {
  const mm = mindmapFor('原穴', Q, links);
  const br = branchesOf(mm);
  assert.ok(br.some((b) => b.type === 'linked'));
  assert.ok(br.some((b) => b.type === 'compare'));
  assert.ok(br.some((b) => b.type === 'number'));
  const laid = radialLayout(br);
  assert.ok(laid.every((b) => typeof b.x === 'number' && typeof b.y === 'number'));
});
