import test from 'node:test';
import assert from 'node:assert/strict';
import {
  leechSince, leechDwellDays, leechList, leechBySubject,
  firstWrongAt, reviewDwellBySubject, resolvedLeechEvents, resolvedLeechesSince,
  reviewDwellByMissType, leechListToCsv,
} from '../src/lib/reviewDwell.js';
import { LEECH_THRESHOLD, MASTER_STREAK, emptyState } from '../src/lib/srs.js';

const DAY = 24 * 60 * 60 * 1000;

function wrongHistory(questionId, count, startAt) {
  return Array.from({ length: count }, (_, i) => ({ questionId, correct: false, at: startAt + i * DAY }));
}

test('leechSince: 誤答回数がLEECH_THRESHOLDに達した瞬間のatを返す', () => {
  const start = Date.now() - 100 * DAY;
  const history = wrongHistory('q1', LEECH_THRESHOLD, start);
  const since = leechSince('q1', history);
  assert.equal(since, history[LEECH_THRESHOLD - 1].at);
});

test('leechSince: 閾値未満ならnull', () => {
  const history = wrongHistory('q1', LEECH_THRESHOLD - 1, Date.now());
  assert.equal(leechSince('q1', history), null);
});

test('leechDwellDays: 要注意になってからの経過日数', () => {
  const start = Date.now() - 100 * DAY;
  const history = wrongHistory('q1', LEECH_THRESHOLD, start);
  const now = history[LEECH_THRESHOLD - 1].at + 5 * DAY;
  assert.equal(leechDwellDays('q1', history, now), 5);
});

test('leechList: 要注意問題を滞留日数の長い順に並べる', () => {
  const now = Date.now();
  const q1 = { id: 'q1', subject: 'A' };
  const q2 = { id: 'q2', subject: 'B' };
  const srs = {
    q1: { ...emptyState(), wrongCount: LEECH_THRESHOLD },
    q2: { ...emptyState(), wrongCount: LEECH_THRESHOLD },
  };
  const history = [
    ...wrongHistory('q1', LEECH_THRESHOLD, now - 20 * DAY),
    ...wrongHistory('q2', LEECH_THRESHOLD, now - 5 * DAY),
  ];
  const list = leechList([q1, q2], srs, history, now);
  assert.equal(list.length, 2);
  assert.equal(list[0].question.id, 'q1'); // より長く滞留している方が先頭
});

test('leechBySubject: 科目別に件数を集計する', () => {
  const q1 = { id: 'q1', subject: 'A' };
  const q2 = { id: 'q2', subject: 'A' };
  const q3 = { id: 'q3', subject: 'B' };
  const srs = {
    q1: { ...emptyState(), wrongCount: LEECH_THRESHOLD },
    q2: { ...emptyState(), wrongCount: LEECH_THRESHOLD },
    q3: { ...emptyState(), wrongCount: 1 },
  };
  const rows = leechBySubject([q1, q2, q3], srs);
  assert.deepEqual(rows, [{ subject: 'A', count: 2 }]);
});

test('firstWrongAt: 最初に間違えた時刻を返す', () => {
  const history = [
    { questionId: 'q1', correct: true, at: 1 },
    { questionId: 'q1', correct: false, at: 2 },
    { questionId: 'q1', correct: false, at: 3 },
  ];
  assert.equal(firstWrongAt('q1', history), 2);
});

test('reviewDwellBySubject: 未解消の復習対象の科目別平均滞留日数', () => {
  const now = Date.now();
  const q1 = { id: 'q1', subject: 'A' };
  const q2 = { id: 'q2', subject: 'A' };
  const srs = {
    q1: { ...emptyState(), wrongCount: 1, correctStreak: 0 },
    q2: { ...emptyState(), wrongCount: 1, correctStreak: 0 },
  };
  const history = [
    { questionId: 'q1', correct: false, at: now - 10 * DAY },
    { questionId: 'q2', correct: false, at: now - 20 * DAY },
  ];
  const rows = reviewDwellBySubject([q1, q2], srs, history, now);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].subject, 'A');
  assert.equal(rows[0].avgDays, 15);
  assert.equal(rows[0].count, 2);
});

test('reviewDwellBySubject: マスター済みは対象外', () => {
  const now = Date.now();
  const q1 = { id: 'q1', subject: 'A' };
  const srs = { q1: { ...emptyState(), wrongCount: 1, correctStreak: MASTER_STREAK } };
  const history = [{ questionId: 'q1', correct: false, at: now - 10 * DAY }];
  assert.deepEqual(reviewDwellBySubject([q1], srs, history, now), []);
});

test('resolvedLeechEvents: 要注意化→5連続○のマスター到達を検知する', () => {
  const start = Date.now() - 100 * DAY;
  const history = [
    ...wrongHistory('q1', LEECH_THRESHOLD, start),
    ...Array.from({ length: MASTER_STREAK }, (_, i) => ({
      questionId: 'q1', correct: true, at: start + (LEECH_THRESHOLD + i) * DAY,
    })),
  ];
  const events = resolvedLeechEvents(history);
  assert.equal(events.length, 1);
  assert.equal(events[0].questionId, 'q1');
});

test('resolvedLeechEvents: 要注意未満のまま正解してもイベントにならない', () => {
  const history = [
    ...wrongHistory('q1', LEECH_THRESHOLD - 1, Date.now() - 10 * DAY),
    ...Array.from({ length: MASTER_STREAK }, (_, i) => ({ questionId: 'q1', correct: true, at: Date.now() - i })),
  ];
  assert.equal(resolvedLeechEvents(history).length, 0);
});

test('resolvedLeechesSince: 基準時刻以降のイベント数だけ数える', () => {
  const start = Date.now() - 100 * DAY;
  const history = [
    ...wrongHistory('q1', LEECH_THRESHOLD, start),
    ...Array.from({ length: MASTER_STREAK }, (_, i) => ({
      questionId: 'q1', correct: true, at: start + (LEECH_THRESHOLD + i) * DAY,
    })),
  ];
  assert.equal(resolvedLeechesSince(history, Date.now() + 1), 0);
  assert.equal(resolvedLeechesSince(history, start), 1);
});

test('reviewDwellByMissType: 誤答理由（型）別の平均滞留日数', () => {
  const now = Date.now();
  const q1 = { id: 'q1', subject: 'A' };
  const q2 = { id: 'q2', subject: 'A' };
  const q3 = { id: 'q3', subject: 'A' }; // 型の記録なし
  const srs = {
    q1: { ...emptyState(), wrongCount: 1, correctStreak: 0 },
    q2: { ...emptyState(), wrongCount: 1, correctStreak: 0 },
    q3: { ...emptyState(), wrongCount: 1, correctStreak: 0 },
  };
  const history = [
    { questionId: 'q1', correct: false, at: now - 10 * DAY },
    { questionId: 'q2', correct: false, at: now - 20 * DAY },
    { questionId: 'q3', correct: false, at: now - 30 * DAY },
  ];
  const missTypes = {
    q1: [{ type: 'careless', at: now - 10 * DAY }],
    q2: [{ type: 'careless', at: now - 20 * DAY }],
  };
  const rows = reviewDwellByMissType([q1, q2, q3], srs, history, missTypes, now);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'careless');
  assert.equal(rows[0].avgDays, 15);
  assert.equal(rows[0].count, 2);
});

test('leechListToCsv: 科目・問題文・滞留日数のCSVを作る', () => {
  const list = [
    { question: { subject: '解剖学', question: '心臓の弁は？' }, dwellDays: 10 },
    { question: { subject: '生理学', question: 'カンマ,を含む問題文' }, dwellDays: null },
  ];
  const csv = leechListToCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], '科目,問題文,滞留日数');
  assert.equal(lines[1], '解剖学,心臓の弁は？,10');
  assert.equal(lines[2], '生理学,"カンマ,を含む問題文",');
});

test('reviewDwellByMissType: マスター済み・型未記録は対象外', () => {
  const now = Date.now();
  const q1 = { id: 'q1', subject: 'A' };
  const srs = { q1: { ...emptyState(), wrongCount: 1, correctStreak: MASTER_STREAK } };
  const history = [{ questionId: 'q1', correct: false, at: now - 10 * DAY }];
  const missTypes = { q1: [{ type: 'careless', at: now - 10 * DAY }] };
  assert.deepEqual(reviewDwellByMissType([q1], srs, history, missTypes, now), []);
});
