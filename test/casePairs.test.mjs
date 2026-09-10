import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCaseContinuation,
  buildCaseLinkMap,
  partnerOf,
  keepCasePairsAdjacent,
  keepCasePairsAdjacentObjects,
} from '../src/lib/casePairs.js';

function q(id, question, subject = 'S') {
  return { id, question, subject, type: 'choice', choices: ['a', 'b', 'c', 'd'], answer: 0, explanation: 'e' };
}

test('isCaseContinuation: 「（上記◯◯の続き）」で始まる設問だけを検出する', () => {
  assert.equal(isCaseContinuation(q('a', '（上記症例の続き）治療方針として適切なのはどれか。')), true);
  assert.equal(isCaseContinuation(q('a', '（上記の更年期の症例の続き）病証はどれか。')), true);
  assert.equal(isCaseContinuation(q('a', '通常の設問文。')), false);
  assert.equal(isCaseContinuation(null), false);
});

test('buildCaseLinkMap: 派生（id末尾が英字）を挟んでいても直近の原問へ正しく結びつく', () => {
  const pool = [
    q('tk-x-1', '症例本文…どれか。'),
    q('tk-x-1a', '派生問題A'),
    q('tk-x-1b', '派生問題B'),
    q('tk-y-1', '（上記症例の続き）治療方針はどれか。'),
  ];
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  assert.equal(linkOf.get('tk-y-1'), 'tk-x-1');
  assert.equal(pairOf.get('tk-x-1'), 'tk-y-1');
});

test('buildCaseLinkMap: 無関係な派生の直後にあるだけでは誤って結びつかない', () => {
  // tk-y-1の直前はtk-unrelated-1a（無関係な問題の派生）だが、そのさらに前のtk-unrelated-1
  // ではなく、正しく遡って原問を探す（この場合はtk-x-1が正しい親）。
  const pool = [
    q('tk-x-1', '本当の親となる症例。'),
    q('tk-unrelated-1', '無関係な別の原問。'),
    q('tk-unrelated-1a', '無関係な派生。'),
    q('tk-y-1', '（上記症例の続き）続きの設問。'),
  ];
  const { linkOf } = buildCaseLinkMap(pool);
  assert.equal(linkOf.get('tk-y-1'), 'tk-unrelated-1');
});

test('buildCaseLinkMap: 科目境界を越えて結びつけない', () => {
  const pool = [
    { ...q('tk-x-1', '別科目の設問。'), subject: 'A' },
    { ...q('tk-y-1', '（上記症例の続き）続き。'), subject: 'B' },
  ];
  const { linkOf } = buildCaseLinkMap(pool);
  assert.equal(linkOf.has('tk-y-1'), false);
});

test('partnerOf: 続き→原問、原問→続き のどちらからでも相方を引ける', () => {
  const pool = [q('tk-x-1', '原問。'), q('tk-y-1', '（上記症例の続き）続き。')];
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  assert.equal(partnerOf('tk-y-1', linkOf, pairOf), 'tk-x-1');
  assert.equal(partnerOf('tk-x-1', linkOf, pairOf), 'tk-y-1');
  assert.equal(partnerOf('tk-z-1', linkOf, pairOf), null);
});

test('keepCasePairsAdjacent: バラバラの出題順でも連問を隣接させる（原問が先）', () => {
  const pool = [q('tk-x-1', '原問。'), q('tk-y-1', '（上記症例の続き）続き。'), q('tk-z-1', '無関係。')];
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  const shuffled = ['tk-z-1', 'tk-y-1', 'tk-x-1'];
  const result = keepCasePairsAdjacent(shuffled, linkOf, pairOf);
  const xi = result.indexOf('tk-x-1');
  const yi = result.indexOf('tk-y-1');
  assert.equal(yi, xi + 1, '原問の直後に続きが来ること');
  assert.deepEqual(result.length, 3);
});

test('keepCasePairsAdjacent: 相方が出題順に含まれていなければ何もしない', () => {
  const pool = [q('tk-x-1', '原問。'), q('tk-y-1', '（上記症例の続き）続き。')];
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  const result = keepCasePairsAdjacent(['tk-y-1', 'tk-z-1'], linkOf, pairOf);
  assert.deepEqual(result, ['tk-y-1', 'tk-z-1']);
});

test('keepCasePairsAdjacent: 周回で同じidが複数回現れても壊れない（件数が変わらない）', () => {
  const pool = [q('tk-x-1', '原問。'), q('tk-y-1', '（上記症例の続き）続き。'), q('tk-z-1', '無関係。')];
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  const repeated = ['tk-z-1', 'tk-y-1', 'tk-x-1', 'tk-x-1', 'tk-z-1', 'tk-y-1'];
  const result = keepCasePairsAdjacent(repeated, linkOf, pairOf);
  assert.equal(result.length, repeated.length);
  // 数えた中身も変わらない（並べ替えただけ）
  assert.deepEqual([...result].sort(), [...repeated].sort());
});

test('keepCasePairsAdjacentObjects: 問題オブジェクトの配列でも同様に隣接させる', () => {
  const pool = [q('tk-x-1', '原問。'), q('tk-y-1', '（上記症例の続き）続き。'), q('tk-z-1', '無関係。')];
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  const shuffled = [pool[2], pool[1], pool[0]];
  const result = keepCasePairsAdjacentObjects(shuffled, linkOf, pairOf);
  const xi = result.findIndex((r) => r.id === 'tk-x-1');
  const yi = result.findIndex((r) => r.id === 'tk-y-1');
  assert.equal(yi, xi + 1);
});

test('buildCaseLinkMap: 3問以上つながる症例チェーンにも対応する', () => {
  const pool = [
    q('tk-x-1', '原問（第1問）。'),
    q('tk-x-2', '（上記症例の続き）第2問。'),
    q('tk-x-3', '（上記症例の続き）第3問。'),
  ];
  const { linkOf, pairOf } = buildCaseLinkMap(pool);
  const result = keepCasePairsAdjacent(['tk-x-3', 'tk-x-1', 'tk-x-2'], linkOf, pairOf);
  assert.deepEqual(result, ['tk-x-1', 'tk-x-2', 'tk-x-3']);
});
