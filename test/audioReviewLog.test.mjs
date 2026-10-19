import test from 'node:test';
import assert from 'node:assert/strict';
import {
  audioReviewCountSince, completionRateByTarget, topCombos,
  recentCombo, previousFinish, daysSinceLastAudioReview,
} from '../src/lib/audioReviewLog.js';

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

test('recentCombo: 直近1回のstartを返す（2回未満でも使える）', () => {
  const log = [
    { kind: 'start', subject: '解剖学', target: 10, at: 5 },
    { kind: 'start', subject: '生理学', target: 60, at: 1 },
  ];
  assert.deepEqual(recentCombo(log), { subject: '解剖学', target: 10 });
});

test('recentCombo: ログが空ならnull', () => {
  assert.equal(recentCombo([]), null);
});

test('previousFinish: 同じ件数・同じ科目の直前の完了実績から正答率を出す', () => {
  const log = [
    { kind: 'finish', target: 60, subject: '解剖学', graded: 50, wrong: 10, at: 1 },
    { kind: 'finish', target: 10, subject: '解剖学', graded: 10, wrong: 0, at: 2 },
  ];
  const prev = previousFinish(log, { target: 60, subject: '解剖学' });
  assert.equal(prev.graded, 50);
  assert.equal(prev.wrong, 10);
  assert.equal(prev.accuracyPct, 80);
});

test('previousFinish: 一致する記録が無ければnull', () => {
  assert.equal(previousFinish([], { target: 60, subject: '解剖学' }), null);
});

test('previousFinish: nullの科目はnull同士でだけ一致する', () => {
  const log = [{ kind: 'finish', target: 60, subject: null, graded: 10, wrong: 2, at: 1 }];
  assert.ok(previousFinish(log, { target: 60, subject: null }));
  assert.equal(previousFinish(log, { target: 60, subject: '解剖学' }), null);
});

test('daysSinceLastAudioReview: 最後に完了した日からの日数', () => {
  const now = 10 * 24 * 60 * 60 * 1000;
  const log = [{ kind: 'finish', at: now - 3 * 24 * 60 * 60 * 1000 }];
  assert.equal(daysSinceLastAudioReview(log, now), 3);
});

test('daysSinceLastAudioReview: 完了が無ければnull', () => {
  assert.equal(daysSinceLastAudioReview([]), null);
});
