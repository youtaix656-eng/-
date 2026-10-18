import test from 'node:test';
import assert from 'node:assert/strict';
import { audioReviewCountSince, completionRateByTarget, topCombos } from '../src/lib/audioReviewLog.js';

test('audioReviewCountSince: 指定時刻以降のstartだけを数える', () => {
  const log = [
    { kind: 'start', at: 100 },
    { kind: 'finish', at: 100 },
    { kind: 'start', at: 50 },
    { kind: 'start', at: 5 },
  ];
  assert.equal(audioReviewCountSince(log, 10), 2);
});

test('completionRateByTarget: 件数ごとの開始数・完了数・完了率', () => {
  const log = [
    { kind: 'start', target: 10, at: 1 },
    { kind: 'start', target: 10, at: 2 },
    { kind: 'finish', target: 10, at: 2 },
    { kind: 'start', target: null, at: 3 },
  ];
  const out = completionRateByTarget(log);
  assert.equal(out['10'].starts, 2);
  assert.equal(out['10'].finishes, 1);
  assert.equal(out['10'].rate, 0.5);
  assert.equal(out.all.starts, 1);
  assert.equal(out.all.finishes, 0);
  assert.equal(out.all.rate, 0);
});

test('topCombos: 2回以上使った組み合わせだけを多い順に返す', () => {
  const log = [
    { kind: 'start', subject: '解剖学', target: 60, at: 1 },
    { kind: 'start', subject: '解剖学', target: 60, at: 2 },
    { kind: 'start', subject: '解剖学', target: 60, at: 3 },
    { kind: 'start', subject: '生理学', target: 10, at: 4 },
    { kind: 'start', subject: '生理学', target: 10, at: 5 },
    { kind: 'start', subject: '病理学概論', target: 300, at: 6 }, // 1回だけ＝対象外
  ];
  const out = topCombos(log, 3);
  assert.equal(out.length, 2);
  assert.equal(out[0].subject, '解剖学');
  assert.equal(out[0].target, 60);
  assert.equal(out[0].count, 3);
  assert.equal(out[1].subject, '生理学');
});

test('topCombos: ログが空なら空配列', () => {
  assert.deepEqual(topCombos([]), []);
});
