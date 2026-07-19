import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXAM_SUBJECTS,
  EXAM_INFO,
  subjectMatches,
  scopeCoverage,
} from '../src/data/examScope.js';

test('13科目が定義され、午前9・午後4に分かれる', () => {
  assert.equal(EXAM_SUBJECTS.length, 13);
  assert.equal(EXAM_SUBJECTS.filter((s) => s.session === 'am').length, 9);
  assert.equal(EXAM_SUBJECTS.filter((s) => s.session === 'pm').length, 4);
});

test('合格ラインは60%', () => {
  assert.equal(EXAM_INFO.passRate, 0.6);
});

test('科目名の別名照合（はり理論 / きゅう理論）', () => {
  const hariKyu = EXAM_SUBJECTS.find((s) => s.id === 'hari_kyu');
  assert.ok(subjectMatches('はり理論', hariKyu));
  assert.ok(subjectMatches('きゅう理論', hariKyu));
  assert.ok(subjectMatches('はりきゅう理論', hariKyu));
});

test('病理学の別名照合', () => {
  const byori = EXAM_SUBJECTS.find((s) => s.id === 'byori');
  assert.ok(subjectMatches('病理学概論', byori));
  assert.ok(subjectMatches('病理学', byori));
});

test('無関係な科目は一致しない', () => {
  const kaibou = EXAM_SUBJECTS.find((s) => s.id === 'kaibou');
  assert.ok(!subjectMatches('東洋医学概論', kaibou));
});

test('scopeCoverage が収録数と正答率を集計する', () => {
  const questions = [
    { id: 'q1', subject: '解剖学' },
    { id: 'q2', subject: '解剖学' },
    { id: 'q3', subject: 'はり理論' },
  ];
  const history = [
    { questionId: 'q1', subject: '解剖学', correct: true },
    { questionId: 'q2', subject: '解剖学', correct: false },
  ];
  const cov = scopeCoverage(questions, history);
  const kaibou = cov.find((c) => c.subject.id === 'kaibou');
  assert.equal(kaibou.count, 2);
  assert.equal(kaibou.answered, 2);
  assert.equal(kaibou.correct, 1);
  assert.equal(kaibou.accuracy, 0.5);
  const hariKyu = cov.find((c) => c.subject.id === 'hari_kyu');
  assert.equal(hariKyu.count, 1); // はり理論がひも付く
});
