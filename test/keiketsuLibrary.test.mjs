import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePage, addPage, removePage, searchPages, snippetFor, buildSearchPrompt } from '../src/lib/keiketsuLibrary.js';

test('makePageはtitle・textをtrimし、無題の既定値を持つ', () => {
  const p = makePage({ title: '  合谷 P12  ', text: '  本文  ' });
  assert.equal(p.title, '合谷 P12');
  assert.equal(p.text, '本文');
  assert.ok(p.id);
  assert.ok(typeof p.addedAt === 'number');

  const noTitle = makePage({ title: '', text: '本文のみ' });
  assert.equal(noTitle.title, '（無題）');
});

test('makePageは呼ぶたびに異なるidを発行する', () => {
  const a = makePage({ title: 'a', text: 'x' });
  const b = makePage({ title: 'b', text: 'y' });
  assert.notEqual(a.id, b.id);
});

test('addPage/removePageは元の配列を書き換えない', () => {
  const pages = [makePage({ title: '1', text: 'a' })];
  const added = addPage(pages, makePage({ title: '2', text: 'b' }));
  assert.equal(pages.length, 1);
  assert.equal(added.length, 2);

  const removed = removePage(added, added[0].id);
  assert.equal(removed.length, 1);
  assert.equal(added.length, 2);
});

test('searchPagesはtitle・textの部分一致（大文字小文字を区別しない）で絞り込む', () => {
  const pages = [
    makePage({ title: '合谷', text: '手陽明大腸経の原穴。ABC' }),
    makePage({ title: '足三里', text: '足陽明胃経の合土穴。' }),
  ];
  assert.equal(searchPages(pages, '合谷').length, 1);
  assert.equal(searchPages(pages, '胃経').length, 1);
  assert.equal(searchPages(pages, 'abc').length, 1); // 大文字小文字を区別しない
  assert.equal(searchPages(pages, '').length, 2); // 空クエリは全件
  assert.equal(searchPages(pages, '存在しない語').length, 0);
});

test('snippetForはクエリ周辺の抜粋を返す', () => {
  const text = 'あ'.repeat(60) + 'キーワード' + 'い'.repeat(60);
  const s = snippetFor(text, 'キーワード', 10);
  assert.ok(s.includes('キーワード'));
  assert.ok(s.length < text.length);
});

test('snippetForはクエリが空・不一致でも例外を投げない', () => {
  assert.equal(typeof snippetFor('本文', ''), 'string');
  assert.equal(typeof snippetFor('本文', '該当なし'), 'string');
  assert.equal(snippetFor('', 'x'), '');
});

test('buildSearchPrompt: 本文が差し込まれ、原文保護の厳守事項・照合表の指示が含まれる', () => {
  const pages = [makePage({ title: '合谷 P12', text: '合谷はLI4、手陽明大腸経の原穴。' })];
  const prompt = buildSearchPrompt(pages);
  assert.ok(prompt.includes('合谷 P12'));
  assert.ok(prompt.includes('合谷はLI4、手陽明大腸経の原穴。'));
  assert.ok(prompt.includes('照合表'));
  assert.ok(prompt.includes('数字・単位'));
  assert.ok(prompt.includes('推測・記憶で補わない'));
});

test('buildSearchPrompt: 複数ページはタイトルごとに区切って連結される', () => {
  const pages = [
    makePage({ title: 'ページA', text: '本文A' }),
    makePage({ title: 'ページB', text: '本文B' }),
  ];
  const prompt = buildSearchPrompt(pages);
  const idxA = prompt.indexOf('ページA');
  const idxB = prompt.indexOf('ページB');
  assert.ok(idxA !== -1 && idxB !== -1 && idxA < idxB);
  assert.ok(prompt.includes('本文A'));
  assert.ok(prompt.includes('本文B'));
});

test('buildSearchPrompt: 材料が0件でもテンプレートは崩れず未登録の旨を示す', () => {
  const prompt = buildSearchPrompt([]);
  assert.ok(prompt.includes('教科書材料が未登録です'));
  assert.ok(prompt.includes('照合表'));
});
