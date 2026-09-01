import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStartOf, buildWeeklyReport } from '../src/lib/weeklyJournal.js';

test('weekStartOf: 月曜0時に揃う', () => {
  const sun = new Date('2026-08-23T15:00:00'); // 日曜（2026-08-17週の最終日）
  const mon = new Date(weekStartOf(sun));
  assert.equal(mon.getDay(), 1);
  assert.equal(mon.getHours(), 0);
  // 同じ週の別の曜日（水曜）でも同じ週の始まりになる
  const wed = new Date('2026-08-19T09:00:00');
  assert.equal(weekStartOf(wed), weekStartOf(sun));
  // 翌週の月曜は7日後になる
  const nextMon = new Date('2026-08-24T09:00:00');
  assert.equal(weekStartOf(nextMon), weekStartOf(sun) + 7 * 24 * 60 * 60 * 1000);
});

test('buildWeeklyReport: 直近7日間だけを集計し、範囲外は無視する', () => {
  const now = new Date('2026-08-23T12:00:00').getTime();
  const DAY = 24 * 60 * 60 * 1000;
  const history = [
    { questionId: 'a', correct: true, at: now - 1 * DAY, subject: 'X' },
    { questionId: 'b', correct: false, at: now - 2 * DAY, subject: 'X' },
    { questionId: 'c', correct: false, at: now - 10 * DAY, subject: 'X' }, // 範囲外
  ];
  const out = buildWeeklyReport(history, {}, [], {}, now);
  assert.equal(out.total, 2);
  assert.equal(out.correct, 1);
  assert.equal(out.wrongCount, 1);
});

test('buildWeeklyReport: 誤答理由の型の内訳と最頻値', () => {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const history = [
    { questionId: 'a', correct: false, at: now - DAY },
    { questionId: 'b', correct: false, at: now - DAY },
    { questionId: 'c', correct: false, at: now - DAY },
  ];
  const missTypes = {
    a: { type: 'careless' },
    b: { type: 'careless' },
    c: { type: 'chishiki' },
  };
  const out = buildWeeklyReport(history, missTypes, [], {}, now);
  assert.equal(out.topType, 'careless');
  assert.equal(out.typeCounts.careless, 2);
  assert.equal(out.typeCounts.chishiki, 1);
});

test('buildWeeklyReport: 解答が無ければaccuracyはnull', () => {
  const out = buildWeeklyReport([], {}, [], {}, Date.now());
  assert.equal(out.total, 0);
  assert.equal(out.accuracy, null);
  assert.equal(out.topType, null);
});

test('buildWeeklyReport: 弱点タグに過去問の出題回数（roundCount）が付く', () => {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const questions = [
    { id: 'a', subject: 'X', tags: ['頻出語'], round: 30 },
    { id: 'b', subject: 'X', tags: ['頻出語'], round: 31 },
    { id: 'c', subject: 'X', tags: ['頻出語'], round: 32 },
    { id: 'd', subject: 'X', tags: ['レア語'], round: 30 },
  ];
  const history = [
    { questionId: 'a', correct: false, at: now - DAY, subject: 'X' },
    { questionId: 'd', correct: false, at: now - DAY, subject: 'X' },
  ];
  const out = buildWeeklyReport(history, {}, questions, {}, now);
  const freq = out.weakTags.find((w) => w.tag === '頻出語');
  const rare = out.weakTags.find((w) => w.tag === 'レア語');
  assert.equal(freq.roundCount, 3); // 3回にまたがって出題＝頻出
  assert.equal(rare.roundCount, 1); // 1回のみ＝頻出ではない
});

test('buildWeeklyReport: trendはmissTypeTrendをそのまま返す（データ不足ならnull）', () => {
  const out = buildWeeklyReport([], {}, [], {}, Date.now());
  assert.equal(out.trend, null); // missTypesが空＝母数不足でnull
});

test('buildWeeklyReport: roundLogを渡すと300問1周の短縮率が出る', () => {
  const roundLog = [
    { target: 300, ms: 60000, count: 300, at: 1 },
    { target: 300, ms: 30000, count: 300, at: 2 },
  ];
  const out = buildWeeklyReport([], {}, [], {}, Date.now(), roundLog);
  assert.equal(out.speedup300, 50);
});

test('buildWeeklyReport: roundLogを渡さなければspeedup300はnull（後方互換）', () => {
  const out = buildWeeklyReport([], {}, [], {}, Date.now());
  assert.equal(out.speedup300, null);
});
