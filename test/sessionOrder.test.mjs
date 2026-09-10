import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrder, buildNewOnlyOrder } from '../src/lib/sessionOrder.js';
import { buildCaseLinkMap } from '../src/lib/casePairs.js';

// 誤答復習・○の見直し等が渡す「解いた順」に並び替えられたプールは、casePairs.jsが前提とする
// 「元の収録順」ではない。以前はbuildOrder等が常にpool自身からbuildCaseLinkMapを作り直して
// いたため、こうしたプールでは無関係な2問を連問と誤検出しうるバグがあった。今は呼び出し側
// （Session.jsx・Quiz.jsxはstore.casePairMap＝常に全体のquestionsから導出）が渡した対応表を
// 使うようになっているので、その配線を確認する。

test('buildOrder: 明示的なcaseLinkMapが渡された場合、pool自身から作り直さずそれを使う', () => {
  const pool = [
    { id: 'm1', subject: 'S', question: '普通の設問1' },
    { id: 'm2', subject: 'S', question: '普通の設問2' },
  ];
  // pool自身のテキストからは連問として自動検出されない
  assert.equal(buildCaseLinkMap(pool).linkOf.size, 0);
  // 明示的に渡した対応表があれば、m1の直後にm2が来るよう常に強制される
  //（＝内部でpoolから作り直さず、渡された対応表をそのまま使っている証拠）
  const explicitMap = { linkOf: new Map([['m2', 'm1']]), pairOf: new Map([['m1', 'm2']]) };
  const ids = buildOrder(pool, 2, explicitMap);
  assert.deepEqual(ids, ['m1', 'm2']);
});

test('buildNewOnlyOrder: 明示的なcaseLinkMapが渡された場合、pool自身から作り直さずそれを使う', () => {
  const pool = [
    { id: 'm1', subject: 'S', question: '普通の設問1' },
    { id: 'm2', subject: 'S', question: '普通の設問2' },
  ];
  const explicitMap = { linkOf: new Map([['m2', 'm1']]), pairOf: new Map([['m1', 'm2']]) };
  const ids = buildNewOnlyOrder(pool, 2, {}, explicitMap);
  assert.deepEqual(ids, ['m1', 'm2']);
});

test('buildOrder: caseLinkMapを省略すると従来通りpool自身から自動検出する（後方互換）', () => {
  const pool = [
    { id: 'x1', subject: 'S', question: '症例本文。' },
    { id: 'x2', subject: 'S', question: '（上記症例の続き）続きの設問。' },
  ];
  const ids = buildOrder(pool, 2);
  assert.deepEqual(ids, ['x1', 'x2']);
});

test('buildOrder: 誤答復習のような並べ替え済みプールに、真の相方が含まれていなければ無理に隣接させない', () => {
  // 全体の元の収録順：p1（真の親）→x（続き。真の親はp1）→q9（無関係）
  const full = [
    { id: 'p1', subject: 'S', question: '症例本文。' },
    { id: 'x', subject: 'S', question: '（上記症例の続き）続きの設問。' },
    { id: 'q9', subject: 'S', question: '無関係な別の設問。' },
  ];
  const correctMap = buildCaseLinkMap(full);
  assert.equal(correctMap.linkOf.get('x'), 'p1');

  // 誤答復習で「q9とxだけ間違えた」場合のプール（解いた順＝p1は正解していたので含まれない）。
  // 修正前はここでbuildCaseLinkMap(curated)がq9をxの相方と誤検出していた。
  const curated = [full[2], full[1]]; // [q9, x]
  const wrongMapFromSubsetItself = buildCaseLinkMap(curated);
  assert.equal(wrongMapFromSubsetItself.linkOf.get('x'), 'q9'); // ← これが従来のバグ

  // 全体から導出した正しい対応表を渡せば、xの本当の相方(p1)はこのプールに無いので
  // q9とxを連問として結びつけない（＝出題順はbuildOrder内のspaceById由来のみで、
  // 中身の集合は変わらない）。
  const ids = buildOrder(curated, 2, correctMap);
  assert.deepEqual([...ids].sort(), ['q9', 'x']);
});
