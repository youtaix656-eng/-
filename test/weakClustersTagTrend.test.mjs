import test from 'node:test';
import assert from 'node:assert/strict';
import { tagTrend } from '../src/lib/weakClusters.js';

const WEEK = 7 * 24 * 60 * 60 * 1000;

test('tagTrend: 今週より先週の誤答率が高ければ改善(better)', () => {
  const now = Date.now();
  const questions = [{ id: 'q1', tags: ['腎'] }];
  const history = [
    // 先週：2/2誤答（誤答率100%）
    { questionId: 'q1', correct: false, at: now - WEEK - 1000 },
    { questionId: 'q1', correct: false, at: now - WEEK - 2000 },
    // 今週：2/2正解（誤答率0%）
    { questionId: 'q1', correct: true, at: now - 1000 },
    { questionId: 'q1', correct: true, at: now - 2000 },
  ];
  const rows = tagTrend(history, questions, {}, ['腎'], { now });
  assert.equal(rows[0].trend, 'better');
  assert.equal(rows[0].curRate, 0);
  assert.equal(rows[0].prevRate, 1);
});

test('tagTrend: 悪化(worse)も検知する', () => {
  const now = Date.now();
  const questions = [{ id: 'q1', tags: ['肝'] }];
  const history = [
    { questionId: 'q1', correct: true, at: now - WEEK - 1000 },
    { questionId: 'q1', correct: true, at: now - WEEK - 2000 },
    { questionId: 'q1', correct: false, at: now - 1000 },
    { questionId: 'q1', correct: false, at: now - 2000 },
  ];
  const rows = tagTrend(history, questions, {}, ['肝'], { now });
  assert.equal(rows[0].trend, 'worse');
});

test('tagTrend: 母数が少ない(1件)週はnull（当てずっぽうにしない）', () => {
  const now = Date.now();
  const questions = [{ id: 'q1', tags: ['脾'] }];
  const history = [{ questionId: 'q1', correct: false, at: now - 1000 }];
  const rows = tagTrend(history, questions, {}, ['脾'], { now });
  assert.equal(rows[0].curRate, null);
  assert.equal(rows[0].trend, null);
});

test('tagTrend: weakTagClustersの結果オブジェクト（{tag,...}）もそのまま渡せる', () => {
  const now = Date.now();
  const questions = [{ id: 'q1', tags: ['心'] }];
  const rows = tagTrend([], questions, {}, [{ tag: '心', wrong: 3, attempts: 5 }], { now });
  assert.equal(rows[0].tag, '心');
  assert.equal(rows[0].wrong, 3);
});
