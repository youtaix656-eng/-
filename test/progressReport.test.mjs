import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProgressSummary, buildProgressReportHtml } from '../src/lib/progressReport.js';

test('buildProgressSummary: 空データでも落ちない', () => {
  const s = buildProgressSummary({});
  assert.equal(s.total, 0);
  assert.equal(s.accuracy, null);
  assert.equal(s.bestExam, null);
});

test('buildProgressSummary: 履歴・模試結果から集計する', () => {
  const questions = [{ id: 'a', subject: 'X' }, { id: 'b', subject: 'X' }];
  const history = [
    { questionId: 'a', subject: 'X', correct: true, at: 1 },
    { questionId: 'b', subject: 'X', correct: false, at: 2 },
  ];
  const srs = { a: { correctStreak: 5, seen: 5 } };
  const examResults = [
    { mode: 'am', scorePct: 60 },
    { mode: 'pm', scorePct: 75 },
    { mode: 'weak', scorePct: 99 }, // 得意/苦手モードは対象外
  ];
  const s = buildProgressSummary({ history, questions, srs, examResults });
  assert.equal(s.total, 2);
  assert.equal(s.accuracy, 0.5);
  assert.equal(s.bestExam.scorePct, 75);
  assert.equal(s.mastered, 1);
});

test('buildProgressReportHtml: 主要な数値が本文に出力される', () => {
  const summary = {
    total: 123, accuracy: 0.8, activeDays: 10, longestStreak: 5,
    coverage: 0.6, masteryRate: 0.4, mastered: 40,
    earnedBadges: 3, totalBadges: 10, bestExam: { scorePct: 88 },
    generatedAt: Date.now(),
  };
  const html = buildProgressReportHtml(summary);
  assert.match(html, /123/);
  assert.match(html, /80%/);
  assert.match(html, /88%/);
  assert.match(html, /3\/10/);
  assert.match(html, /window\.print/);
});
