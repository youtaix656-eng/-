import test from 'node:test';
import assert from 'node:assert/strict';
import {
  latestSelfKinds,
  maruQuestions,
  maruStatusList,
  excludeMastered,
  orderMaruStatus,
  maruSubjectBreakdown,
  lastMaruReviewAt,
} from '../src/lib/maruPool.js';

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

test('maruStatusList: うっかり○（objectiveCorrect===false）とマスター済みを判定する', () => {
  const pool = [{ id: 'a', subject: '解剖学' }, { id: 'b', subject: '解剖学' }];
  const history = [
    { questionId: 'a', selfKind: 'maru', at: 1, objectiveCorrect: false }, // うっかり○
    { questionId: 'b', selfKind: 'maru', at: 2, objectiveCorrect: true },
  ];
  const srs = { b: { correctStreak: 5 } };
  const list = maruStatusList(pool, history, srs);
  const a = list.find((s) => s.question.id === 'a');
  const b = list.find((s) => s.question.id === 'b');
  assert.equal(a.uncertain, true);
  assert.equal(a.mastered, false);
  assert.equal(b.uncertain, false);
  assert.equal(b.mastered, true);
});

test('excludeMastered: マスター済みを除く', () => {
  const list = [{ mastered: true }, { mastered: false }, { mastered: false }];
  assert.equal(excludeMastered(list).length, 2);
});

test('orderMaruStatus: うっかり○を先頭に、そのあとは古い順', () => {
  const list = [
    { at: 5, uncertain: false, id: 'newer-certain' },
    { at: 1, uncertain: false, id: 'oldest-certain' },
    { at: 3, uncertain: true, id: 'uncertain' },
  ];
  const order = orderMaruStatus(list).map((s) => s.id);
  assert.deepEqual(order, ['uncertain', 'oldest-certain', 'newer-certain']);
});

test('maruSubjectBreakdown: 科目ごとにマスター率が高い順に並ぶ', () => {
  const list = [
    { mastered: true, uncertain: false, question: { subject: 'A' } },
    { mastered: true, uncertain: false, question: { subject: 'A' } },
    { mastered: false, uncertain: true, question: { subject: 'A' } },
    { mastered: true, uncertain: false, question: { subject: 'B' } },
  ];
  const rows = maruSubjectBreakdown(list);
  assert.equal(rows[0].subject, 'B'); // Bは100%マスター
  assert.equal(rows[0].masteredPct, 1);
  assert.equal(rows[1].subject, 'A');
  assert.ok(Math.abs(rows[1].masteredPct - 2 / 3) < 1e-9);
  assert.equal(rows[1].uncertain, 1); // #6：うっかり○の件数も科目別に集計する
});

test('maruSubjectBreakdown: 空リストなら空配列', () => {
  assert.deepEqual(maruSubjectBreakdown([]), []);
  assert.deepEqual(maruSubjectBreakdown(undefined), []);
});

test('lastMaruReviewAt: source:maru-reviewの最新時刻を返す（#12）', () => {
  const history = [
    { source: 'maru-review', at: 10 },
    { source: 'review', at: 20 },
    { source: 'maru-review', at: 30 },
  ];
  assert.equal(lastMaruReviewAt(history), 30);
});

test('lastMaruReviewAt: 記録が無ければnull', () => {
  assert.equal(lastMaruReviewAt([{ source: 'review', at: 1 }]), null);
  assert.equal(lastMaruReviewAt([]), null);
});
