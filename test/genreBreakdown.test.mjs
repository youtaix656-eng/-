import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenreBreakdown } from '../src/lib/genreBreakdown.js';

test('buildGenreBreakdown: ジャンルごとに集計し正答率の低い順に並べる', () => {
  const rows = buildGenreBreakdown([
    { genre: '解剖学', correct: true },
    { genre: '解剖学', correct: false },
    { genre: '生理学', correct: false },
    { genre: '生理学', correct: false },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0][0], '生理学'); // 正答率0%が先頭
  assert.deepEqual(rows[0][1], { total: 2, correct: 0 });
  assert.equal(rows[1][0], '解剖学');
  assert.deepEqual(rows[1][1], { total: 2, correct: 1 });
});

test('buildGenreBreakdown: genreが無ければその他に分類する', () => {
  const rows = buildGenreBreakdown([{ genre: '', correct: true }, { genre: null, correct: false }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], 'その他');
  assert.deepEqual(rows[0][1], { total: 2, correct: 1 });
});

test('buildGenreBreakdown: 空配列は空配列を返す', () => {
  assert.deepEqual(buildGenreBreakdown([]), []);
});
