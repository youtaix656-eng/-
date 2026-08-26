// AI会議 — 複数の社員に同じテーマで意見を出させ、反論させ、統合する。
//
// 流れ：① 各自の意見 → ② 反論（他の意見を読んだうえで） → ③ 統合（議長）
// ユーザーはどの段階にも割り込める（intervene）。

import { newId } from './id.js';

export const MEETING_PHASES = [
  { id: 'opinion', name: '意見', desc: '各社員が独立に意見を出す' },
  { id: 'rebuttal', name: '反論', desc: '他の意見を読んで、危ういところを指摘する' },
  { id: 'synthesis', name: '統合', desc: '議長がまとめ、オーナーへの提案にする' },
];

/**
 * 会議1回でAIを何回呼ぶかの見積り（新規）。
 *   意見（参加人数）＋ 反論（参加人数）＋ 統合（議長1人）
 * 承認画面で「何回ぶんの費用が出るのか」を先に伝えるために使う。
 */
export function estimatedCalls(participantCount) {
  const n = Math.max(0, Number(participantCount) || 0);
  return n * 2 + (n > 0 ? 1 : 0);
}

export const MEETING_ESTIMATED_CALLS = estimatedCalls;

export function createMeeting({ topic, employees = [], chairId = null }) {
  return {
    id: newId('mtg'),
    topic: String(topic || '').trim(),
    participantIds: employees.map((e) => e.id),
    chairId: chairId || (employees.find((e) => e.roleId === 'strategist') || employees[0] || {}).id || null,
    phase: 'opinion',
    status: 'queued',
    rounds: [], // { phase, employeeId, employeeName, text, providerId, model, cost }
    interventions: [], // ユーザーの割り込み
    conclusion: '',
    createdAt: Date.now(),
    finishedAt: null,
    totalCost: 0,
    // 費用の出る実行なので、仕事と同じく1回だけユーザー承認を通す
    costApproved: false,
  };
}

export function opinionPrompt(topic, interventions = []) {
  const extra = interventions.length
    ? `\n\nオーナーからの補足：\n${interventions.map((i) => `- ${i.text}`).join('\n')}`
    : '';
  return (
    `会議のテーマ：${topic}\n\n` +
    'あなたの立場・専門から見た意見を述べてください。' +
    '結論を先に1文で書き、次に理由を3つまで、最後に「自分の意見が外れる条件」を1つ書いてください。' +
    '400字以内。' +
    extra
  );
}

export function rebuttalPrompt(topic, others = []) {
  const list = others.map((o) => `【${o.employeeName}】${o.text}`).join('\n\n');
  return (
    `会議のテーマ：${topic}\n\n` +
    '他の社員の意見です。\n\n' +
    `${list}\n\n` +
    'この中で最も危ういと思う点を1つだけ選び、なぜ危ういか、どう直せばよいかを書いてください。' +
    '同意できる点があれば先に1行で認めてください。300字以内。'
  );
}

export function synthesisPrompt(topic, rounds = [], interventions = []) {
  const opinions = rounds
    .filter((r) => r.phase === 'opinion')
    .map((r) => `【${r.employeeName}】${r.text}`)
    .join('\n\n');
  const rebuttals = rounds
    .filter((r) => r.phase === 'rebuttal')
    .map((r) => `【${r.employeeName}】${r.text}`)
    .join('\n\n');
  const extra = interventions.length
    ? `\n\nオーナーの割り込み：\n${interventions.map((i) => `- ${i.text}`).join('\n')}`
    : '';

  return (
    `会議のテーマ：${topic}\n\n` +
    `## 各社員の意見\n${opinions}\n\n## 反論\n${rebuttals}${extra}\n\n` +
    'あなたは議長です。会議をまとめてください。次の形で書いてください。\n' +
    '1. 合意できたこと\n2. 割れたこと（どちらの条件で正しいか）\n' +
    '3. 追加で調べるべきこと\n4. オーナーへの提案（選択肢は3つまで）\n' +
    '5. 今日やる1つ\n\n' +
    '決めるのはオーナーです。あなたは決定せず、決めやすい形に整えてください。'
  );
}

export function addRound(meeting, round) {
  const rounds = [...meeting.rounds, { id: newId('rnd'), at: Date.now(), ...round }];
  return { ...meeting, rounds, totalCost: rounds.reduce((s, r) => s + (r.cost || 0), 0) };
}

export function intervene(meeting, text) {
  return {
    ...meeting,
    interventions: [...meeting.interventions, { at: Date.now(), text: String(text) }],
  };
}

export function meetingProgress(meeting) {
  const n = meeting.participantIds.length || 1;
  const expected = n * 2 + 1; // 意見 + 反論 + 統合
  return Math.min(100, Math.round((meeting.rounds.length / expected) * 100));
}
