import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeImageEntry,
  addImageEntry,
  removeImageEntry,
  sortByPage,
  imagesInRange,
} from '../src/lib/keizetsuPageImages.js';

test('makeImageEntry: 正の整数のページ番号だけを採用し、それ以外はnullにする', () => {
  assert.equal(makeImageEntry({ pageNumber: '30', label: 'A', dataUrl: 'x' }).pageNumber, 30);
  assert.equal(makeImageEntry({ pageNumber: 30.7, dataUrl: 'x' }).pageNumber, 30);
  assert.equal(makeImageEntry({ pageNumber: '', dataUrl: 'x' }).pageNumber, null);
  assert.equal(makeImageEntry({ pageNumber: '0', dataUrl: 'x' }).pageNumber, null);
  assert.equal(makeImageEntry({ pageNumber: '-5', dataUrl: 'x' }).pageNumber, null);
  assert.equal(makeImageEntry({ pageNumber: 'abc', dataUrl: 'x' }).pageNumber, null);
});

test('makeImageEntry: label の前後空白を除き、idとaddedAtを持つ', () => {
  const e = makeImageEntry({ pageNumber: 1, label: '  督脈  ', dataUrl: 'data:image/jpeg;base64,xxx' });
  assert.equal(e.label, '督脈');
  assert.ok(e.id);
  assert.ok(Number.isInteger(e.addedAt));
  assert.equal(e.dataUrl, 'data:image/jpeg;base64,xxx');
});

test('addImageEntry / removeImageEntry: 追加・削除ができ、元の配列を書き換えない', () => {
  const base = [];
  const e1 = makeImageEntry({ pageNumber: 1, dataUrl: 'a' });
  const withE1 = addImageEntry(base, e1);
  assert.equal(base.length, 0, '元の配列は不変');
  assert.equal(withE1.length, 1);

  const e2 = makeImageEntry({ pageNumber: 2, dataUrl: 'b' });
  const withBoth = addImageEntry(withE1, e2);
  assert.equal(withBoth.length, 2);

  const removed = removeImageEntry(withBoth, e1.id);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].id, e2.id);
});

test('sortByPage: ページ番号順に並び、ページ不明は末尾（新しい順）になる', () => {
  const a = { id: 'a', pageNumber: 30, addedAt: 1 };
  const b = { id: 'b', pageNumber: 10, addedAt: 2 };
  const c = { id: 'c', pageNumber: null, addedAt: 3 };
  const d = { id: 'd', pageNumber: null, addedAt: 4 };
  const sorted = sortByPage([a, b, c, d]);
  assert.deepEqual(sorted.map((x) => x.id), ['b', 'a', 'd', 'c']);
});

test('imagesInRange: 指定ページ範囲（両端含む）に属する画像だけを返す', () => {
  const entries = [
    { id: 'x', pageNumber: 25, addedAt: 1 },
    { id: 'y', pageNumber: 26, addedAt: 2 },
    { id: 'z', pageNumber: 38, addedAt: 3 },
    { id: 'w', pageNumber: 39, addedAt: 4 },
    { id: 'v', pageNumber: null, addedAt: 5 },
  ];
  const inGv = imagesInRange(entries, 26, 38);
  assert.deepEqual(inGv.map((e) => e.id).sort(), ['y', 'z']);
  assert.deepEqual(imagesInRange(entries, 1, 1000).map((e) => e.id).sort(), ['w', 'x', 'y', 'z']);
  assert.deepEqual(imagesInRange([], 1, 10), []);
});
