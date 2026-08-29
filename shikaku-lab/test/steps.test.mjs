import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onboardingSteps, allDone, nextStep } from '../src/lib/steps.js';
import { COGNITIVE_QUESTIONS } from '../src/data/cognitiveQuestions.js';
import { makeQuestion } from '../src/lib/convert.js';

const empty = { settings: {}, cognitive: {}, questions: [], myExams: [] };

// 手でチェックを付ける形にすると、押しただけで進んだ気になる。
test('印は実際の状態から導く（手で付ける項目が無い）', () => {
  const steps = onboardingSteps(empty);
  assert.ok(steps.every((s) => s.done === false || s.optional));
  assert.equal(nextStep(empty).id, 'exam');

  const withExam = { ...empty, settings: { examId: 'takken' } };
  assert.equal(onboardingSteps(withExam).find((s) => s.id === 'exam').done, true);
  assert.equal(nextStep(withExam).id, 'date');
});

test('飛ばしてよい項目は、次にやることに出ない', () => {
  const st = { ...empty, settings: { examId: 'takken', examDate: '2099-01-01', weekdayMin: 30, weekendMin: 30 } };
  assert.equal(nextStep(st).id, 'methods', '認知特性（飛ばせる）で止まっています');
});

test('全部そろうと案内が消える', () => {
  const full = {
    settings: {
      examId: 'takken',
      examDate: '2099-01-01',
      weekdayMin: 30,
      weekendMin: 30,
      chosenMethods: ['retrieval'],
      didOpenSpec: true,
    },
    cognitive: Object.fromEntries(COGNITIVE_QUESTIONS.map((q) => [q.id, 2])),
    questions: [makeQuestion({ type: 'choice', question: 'a', choices: ['1', '2'], answer: 0, explanation: 'x' })],
    myExams: [],
  };
  assert.equal(allDone(full), true);
  assert.equal(nextStep(full), null);
});

test('確保時間が0分のままなら「済んだ」にしない', () => {
  const st = { ...empty, settings: { examId: 'takken', examDate: '2099-01-01', weekdayMin: 0, weekendMin: 0 } };
  assert.equal(onboardingSteps(st).find((s) => s.id === 'date').done, false);
});

test('飛び先の画面がすべて指定されている', () => {
  const views = ['home', 'exams', 'convert', 'plan', 'spec', 'toc', 'settings'];
  for (const s of onboardingSteps(empty)) assert.ok(views.includes(s.view), `${s.id} の view：${s.view}`);
});
