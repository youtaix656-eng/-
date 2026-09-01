import test from 'node:test';
import assert from 'node:assert/strict';
import { latestSelfKinds, maruQuestions } from '../src/lib/maruPool.js';

test('latestSelfKinds: selfKind付きの履歴だけを、問題ごとに最新の1件へまとめる', () => {
  const history = [
    { questionId: 'a', selfKind: 'maru', at: 1 },
    { questionId: 'a', selfKind: 'sankaku', at: 2 },
    { questionId: 'b', selfKind: 'maru', at: 5 },
    { questionId: 'c', correct: true, at: 3 }, // selfKindなし（gradeMode等）は無視
  ];
  const map = latestSelfKinds(history);
  assert.equal(map.get('a').selfKind, 'sankaku'); // 後の記録で上書き
  assert.equal(map.get('b').selfKind, 'maru');
  assert.equal(map.has('c'), false);
});

test('maruQuestions: 最新が○の問題だけを返す', () => {
  const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const history = [
    { questionId: 'a', selfKind: 'maru', at: 1 },
    { questionId: 'b', selfKind: 'batsu', at: 1 },
    { questionId: 'c', selfKind: 'maru', at: 1 },
    { questionId: 'c', selfKind: 'sankaku', at: 2 }, // 後で△に変わった＝除外
  ];
  const result = maruQuestions(pool, history).map((q) => q.id);
  assert.deepEqual(result, ['a']);
});

test('maruQuestions: 履歴が空なら空配列', () => {
  const pool = [{ id: 'a' }];
  assert.deepEqual(maruQuestions(pool, []), []);
  assert.deepEqual(maruQuestions(pool, undefined), []);
});

test('maruQuestions: プールが空でも落ちない', () => {
  assert.deepEqual(maruQuestions([], [{ questionId: 'a', selfKind: 'maru', at: 1 }]), []);
  assert.deepEqual(maruQuestions(undefined, []), []);
});
