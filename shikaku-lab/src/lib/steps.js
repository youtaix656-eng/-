// 「次に何をすればよいか」を **実際の状態から導く**（手でチェックを付けさせない）。
//
// 付けさせる形にすると、押しただけで進んだ気になり、実際には何もできていない状態が残る。
// 5つ済んだら、この案内はホームから自動で消える。

import { buildPlan } from './plan.js';
import { isUnanswered } from './cognitive.js';

export function onboardingSteps(state) {
  const s = state.settings || {};
  const plan = buildPlan(state);
  return [
    { id: 'exam', label: '受ける試験を選ぶ', done: Boolean(plan.exam), view: 'exams' },
    { id: 'date', label: '試験日と、確保できる時間を入れる', done: Boolean(plan.schedule) && plan.schedule.totalMinutes > 0, view: 'plan' },
    {
      id: 'cognitive',
      label: '認知特性に答える（飛ばしてもよい）',
      done: !isUnanswered(state.cognitive),
      view: 'plan',
      optional: true,
    },
    { id: 'methods', label: '使う勉強法を選ぶ', done: (s.chosenMethods || []).length > 0, view: 'plan' },
    { id: 'convert', label: '過去問を1問、AIで教材に変えてみる', done: (state.questions || []).length > 0, view: 'convert' },
    { id: 'spec', label: '自分専用アプリの設計書を出す', done: Boolean(s.didOpenSpec), view: 'spec' },
  ];
}

/** 全部済んだか（済んだら案内をしまう） */
export function allDone(state) {
  return onboardingSteps(state).every((st) => st.done || st.optional);
}

/** 次にやる1つ。**迷わせないために1つだけ返す** */
export function nextStep(state) {
  return onboardingSteps(state).find((st) => !st.done && !st.optional) || null;
}
