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

test('buildGenreBreakdown: n=1のたまたま外しが、より母数の多い真に弱いジャンルより上位（苦手扱い）に来ない', () => {
  // 「衛生学」はn=1で1問だけたまたま外した（0%）。「臨床医学各論」はn=10中8問間違え（20%正答）＝
  // より多くの証拠に裏付けられた、真に弱いジャンル。素の正答率だけで並べると衛生学(0%)が
  // 先頭に来てしまうが、ラプラススムージングにより母数の多い方が優先して先頭（＝苦手の1位）になるべき。
  const pairs = [
    { genre: '衛生学', correct: false },
    ...Array.from({ length: 8 }, () => ({ genre: '臨床医学各論', correct: false })),
    ...Array.from({ length: 2 }, () => ({ genre: '臨床医学各論', correct: true })),
  ];
  const rows = buildGenreBreakdown(pairs);
  assert.equal(rows[0][0], '臨床医学各論');
  // 表示する数値（正答率・件数）自体はスムージングせず、素のcorrect/totalのまま
  assert.deepEqual(rows[0][1], { total: 10, correct: 2 });
  assert.equal(rows[1][0], '衛生学');
  assert.deepEqual(rows[1][1], { total: 1, correct: 0 });
});
