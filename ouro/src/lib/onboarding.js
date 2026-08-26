// 最初の道しるべ（新規）。
//
// Ouro は最初から18人が在籍した状態で始まる。役職も25ある。
// 「何から手を付ければいいのか」が分からないまま、いきなり全員に依頼できてしまう。
//
// **チェックを手で付けさせない。** 実際の状態から「もう済んでいるか」を導く
// （付け忘れ・付けたのにやっていない、が起きないため）。
// 済んだものは自動で消え、7つ全部済むとこの案内自体が出なくなる。

import { rulesFilled } from './rules.js';
import { notesOf } from './memory.js';

/**
 * @typedef {{id:string, day:number, title:string, why:string, view:string, arg?:any, label:string}} Step
 */
export const STARTER_STEPS = [
  {
    id: 'inventory',
    day: 1,
    title: 'いまやっている作業を書き出す',
    why: '何を任せられるかは、書き出してみないと分かりません。AI社員が A（任せられる）B（下準備だけ）C（自分でやる）へ仕分けます。',
    view: 'compose',
    label: '棚卸しを頼む',
  },
  {
    id: 'rules',
    day: 2,
    title: '会社のルールを書く',
    why: '目的・読み手・扱うもの・書き方を1度書いておくと、全員が毎回それを読んでから仕事をします。',
    view: 'rules',
    label: 'ルールを書く',
  },
  {
    id: 'doneWhen',
    day: 3,
    title: '完成条件を決めて1件頼む',
    why: '「何をもって完成か」を決めないと、出てきたものが良いのか悪いのか判断できません。',
    view: 'compose',
    label: '条件つきで頼む',
  },
  {
    id: 'finished',
    day: 4,
    title: '最後まで1件終わらせる',
    why: 'まず1件を最後まで通すと、どこが速くなってどこが人の手が要るかが見えます。',
    view: 'ledger',
    label: '台帳を見る',
  },
  {
    id: 'decided',
    day: 5,
    title: '「あなたの判断」を1つ決める',
    why: '成果物の中の「人が決めること」を実際に決めてみると、AIに任せる線引きが分かります。',
    view: 'approvals',
    label: '判断を見る',
  },
  {
    id: 'taught',
    day: 6,
    title: '社員に1つ教える',
    why: '直したい所を1行だけ覚えさせます。次からその社員はそれを読んでから書きます。',
    view: 'ledger',
    label: '結果を見て教える',
  },
  {
    id: 'funnel',
    day: 7,
    title: '収益導線に数字を入れる',
    why: '作業が速くなっても、向きがズレていれば収入にはなりません。どこで人が減っているかを見ます。',
    view: 'funnel',
    label: '数字を入れる',
  },
];

/**
 * それぞれ済んでいるか（実際の状態から導く）。
 * @param {object} state {company, tasks, employees, funnel, settings}
 */
export function starterProgress(state = {}) {
  const tasks = state.tasks || [];
  const employees = state.employees || [];
  const funnel = state.funnel || {};
  const done = {
    inventory: Boolean(state.settings && state.settings.didInventory),
    rules: rulesFilled(state.company && state.company.rules) > 0,
    doneWhen: tasks.some((t) => t.spec && String(t.spec.doneWhen || '').trim()),
    finished: tasks.some((t) => t.status === 'done'),
    decided: tasks.some((t) => (t.decisions || []).some((d) => d.state !== 'open')),
    taught: employees.some((e) => notesOf(e).length > 0),
    funnel: Array.isArray(funnel.entries) && funnel.entries.length > 0,
  };
  const steps = STARTER_STEPS.map((s) => ({ ...s, done: Boolean(done[s.id]) }));
  const next = steps.find((s) => !s.done) || null;
  return { steps, next, doneCount: steps.filter((s) => s.done).length, total: steps.length };
}

/** 棚卸しの依頼文（下書き）。書き出す枠だけ用意して、中身は本人が書く。 */
export function inventoryDraft() {
  return [
    '私がいまやっている作業を、任せられるものと自分でやるものに仕分けてください。',
    '',
    '## いまやっている作業',
    '（ここに、思いつくまま箇条書きで書いてください）',
    '- ',
    '- ',
    '- ',
    '',
    '## 仕分けの基準',
    '- A：ほぼ任せられる（繰り返し発生する・手順が決まっている・完成形が分かる）',
    '- B：下準備だけ任せて、最後は自分が確認する',
    '- C：自分の判断を強く残す（お金・約束・信用に関わるもの）',
    '',
    '## それぞれについて書いてほしいこと',
    '- 渡す材料／やってもらうこと／出来上がるもの／自分が確認する所',
    '- 任せたときに何が楽になるか、逆に何が危ないか',
    '',
    '最後に、**最初に任せるならどれか1つ**を選んで、その理由を書いてください。',
  ].join('\n');
}
