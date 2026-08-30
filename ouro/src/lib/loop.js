// 回し方（OODA と PDCA）。
//
// Ouro には「逆算」「詰まっている段」「やめる基準」「採算」と、判断の材料は
// そろっていたが、**それを順番に回す形が無かった**。材料があっても、
// どの順で見て、どこでAI社員を動かすかが決まっていないと、
// 毎回ゼロから考えることになる。
//
// 決まりごと：
//  ・**2つを混ぜない。** 数字がまだ無いうちは OODA（週1周）、数字が貯まったら
//    PDCA（月1周）。数字ゼロで PDCA を回そうとすると「計画」で止まる。
//    どちらを回すかは**機械が導く**（`suggestMode`）。人が上書きもできる。
//  ・**1周のうち、AIを呼ぶのは1〜2段だけ。** 観察・情勢判断・意思決定・評価は
//    アプリの計算と人の判断でやる（費用ゼロ）。呼ぶのは「行動」と「改善案」だけ。
//  ・**勝手に次へ進めない。** 段を進めるのは人が押した時だけ（自動で進むと、
//    人が見ていないところで費用の出る実行が始まる）。
//  ・**結びつきは片方向。** 仕事の側が `task.loopId` を持つ。周回は taskIds を
//    持たない（`deal.taskIds` の失敗を繰り返さない）。
//  ・**依頼文はアプリの数字から作る**（AIを呼ばずに組み立てる）。人は押すだけ。

import { newId } from './id.js';
import { FUNNEL_STAGES, stageById, labelOf, bottleneck, stageStats, latestEntry, normalizeFunnel, pct } from './funnel.js';

export const LOOP_MODES = {
  ooda: { id: 'ooda', name: 'OODA', sub: '週1周', why: '数字がまだ無い時期。観察して、すぐ動かして、外れを早く引き切る。' },
  pdca: { id: 'pdca', name: 'PDCA', sub: '月1周', why: '数字が貯まってから。計画を立てて、比べて、1つだけ直す。' },
};

/**
 * 段の種類。**AIを呼ぶのは 'ai' だけ**。
 *  human … 人がやる（数字を入れる・決める）
 *  app   … アプリが計算して出す（AIを呼ばない）
 *  ai    … AI社員に依頼する（費用が出る。承認と上限はそのまま通る）
 */
export const OODA_STEPS = [
  {
    id: 'observe', name: '観察', key: 'OBSERVE', kind: 'human',
    what: '出した数・見た人・問い合わせ・買った人を、その日のうちに収益導線へ入れる。',
    note: '0でも入れること。入れていない数字は判断に使えません。',
    go: 'funnel',
  },
  {
    id: 'orient', name: '情勢判断', key: 'ORIENT', kind: 'app',
    what: 'どこで人が減っているかを、アプリに判定させる。',
    note: '自分で決めない。判定はアプリに出させて、それを読む。',
  },
  {
    id: 'decide', name: '意思決定', key: 'DECIDE', kind: 'human',
    what: '直す所を1つだけ決める。',
    note: '2つ直すと、どちらが効いたか分からなくなります。',
  },
  {
    id: 'act', name: '行動', key: 'ACT', kind: 'ai',
    what: '決めた1つを直す成果物を、AI社員に作らせる。',
    note: '出来たら実際に出して、また観察に戻る（1周＝1週間）。',
  },
];

export const PDCA_STEPS = [
  {
    id: 'plan', name: '計画', key: 'PLAN', kind: 'ai',
    what: '今月の目標から、やることと数値目標をAI社員に組ませる。',
    note: '逆算の数字をそのまま渡すので、根拠のある計画になります。',
  },
  {
    id: 'do', name: '実行', key: 'DO', kind: 'human',
    what: '計画どおりに動く。作るものはAI社員へ依頼する。',
    note: '途中で計画を変えない。変えると月末に何が効いたか分からなくなります。',
  },
  {
    id: 'check', name: '評価', key: 'CHECK', kind: 'app',
    what: '月末の数字を入れて、通過率と採算をアプリに出させる。',
    note: '良かった所ではなく、いちばん低い数字を探す。',
    go: 'funnel',
  },
  {
    id: 'act', name: '改善', key: 'ACT', kind: 'ai',
    what: 'いちばん低い数字を1つだけ選び、直し方をAI社員に出させる。',
    note: '翌月に直すのは1つだけ。',
  },
];

export function stepsOf(mode) {
  return mode === 'pdca' ? PDCA_STEPS : OODA_STEPS;
}

/**
 * どちらを回すべきか。**機械が導く**（迷わせない）。
 * 数字の入った週が2つ未満、または売上がまだ0なら OODA。
 * @returns {{mode:'ooda'|'pdca', why:string, forced:boolean}}
 */
export function suggestMode({ venture = null, funnel = null, deals = [] } = {}) {
  if (venture && LOOP_MODES[venture.loopMode]) {
    return { mode: venture.loopMode, why: '自分で選んだ回し方です。', forced: true };
  }
  const f = normalizeFunnel(funnel);
  const weeks = f.entries.length;
  const sold = deals.filter((d) => d.ventureId === (venture && venture.id) && d.status === 'paid').length;
  if (weeks < 2) {
    return { mode: 'ooda', why: `数字の入った週が${weeks}週ぶんです。まず観察から始めます。`, forced: false };
  }
  if (!sold) {
    return { mode: 'ooda', why: 'まだ1件も売れていないので、計画より先に外れを引き切ります。', forced: false };
  }
  return { mode: 'pdca', why: `数字が${weeks}週ぶん貯まり、売れた実績もあります。月ごとに比べられます。`, forced: false };
}

// ── 周回の記録 ──

export function makeLoop(data = {}) {
  const now = Date.now();
  const mode = LOOP_MODES[data.mode] ? data.mode : 'ooda';
  return {
    id: data.id || newId('lp'),
    ventureId: data.ventureId || null,
    mode,
    // 何周目か（1から数える）
    n: Math.max(1, Number(data.n) || 1),
    // いまどの段にいるか
    stepId: stepsOf(mode).some((s) => s.id === data.stepId) ? data.stepId : stepsOf(mode)[0].id,
    // 意思決定で選んだこと（decide / act で使う）
    decision: String(data.decision || '').slice(0, 120),
    decisionStage: String(data.decisionStage || ''),
    startedAt: Number(data.startedAt) || now,
    closedAt: Number(data.closedAt) || 0,
    updatedAt: now,
  };
}

export function loopsOf(loops = [], ventureId) {
  return loops.filter((l) => l.ventureId === ventureId).sort((a, b) => b.n - a.n);
}

/** いま回っている周（閉じていないもの）。無ければ null。 */
export function openLoop(loops = [], ventureId) {
  return loopsOf(loops, ventureId).find((l) => !l.closedAt) || null;
}

/** 次の周回番号。 */
export function nextN(loops = [], ventureId) {
  const mine = loopsOf(loops, ventureId);
  return mine.length ? Math.max(...mine.map((l) => l.n)) + 1 : 1;
}

/** 段を1つ進める。最後の段まで来たら閉じる（**自動では呼ばない**）。 */
export function advance(loop, now = Date.now()) {
  if (!loop) return loop;
  const steps = stepsOf(loop.mode);
  const i = steps.findIndex((s) => s.id === loop.stepId);
  if (i < 0 || i >= steps.length - 1) {
    return { ...loop, closedAt: now, updatedAt: now };
  }
  return { ...loop, stepId: steps[i + 1].id, updatedAt: now };
}

export function stepOf(loop) {
  if (!loop) return null;
  return stepsOf(loop.mode).find((s) => s.id === loop.stepId) || null;
}

export function stepIndex(loop) {
  if (!loop) return 0;
  return Math.max(0, stepsOf(loop.mode).findIndex((s) => s.id === loop.stepId));
}

// ── 意思決定の選択肢 ──
//
// 詰まっている段ごとに、直せることを出す。**段ごとに2つまで**
// （並べすぎると選ぶこと自体が負担になる）。
// 商売の種類に寄せない書き方にしてある（収益導線の段はどの商売にも共通なので）。

const FIXES = {
  reach: [
    { id: 'reach_where', label: '出す場所を変える', why: 'いる所が違えば、何を出しても届きません。', roleId: 'marketer' },
    { id: 'reach_more', label: '出す数を増やす', why: '場所が合っているなら、数が足りていないだけかもしれません。', roleId: 'contentmarketer' },
  ],
  read: [
    { id: 'read_open', label: '書き出しを変える', why: '最初の2行で読むかどうかが決まります。', roleId: 'writer' },
    { id: 'read_narrow', label: '中身を1つに絞る', why: '欲張ると誰にも刺さらなくなります。', roleId: 'creator' },
  ],
  lead: [
    { id: 'lead_ask', label: '次にしてほしいことを1つだけ書く', why: '選ばせると、人は選ばずに離れます。', roleId: 'contentmarketer' },
    { id: 'lead_easy', label: '登録・問い合わせの手間を減らす', why: '欲しい情報が多いほど、途中でやめられます。', roleId: 'analyzer' },
  ],
  sale: [
    { id: 'sale_words', label: '売る文（申し込みの手前）を書き直す', why: '中身が良くても、手前が弱いと手に取ってもらえません。', roleId: 'writer' },
    { id: 'sale_price', label: '値段と範囲を見直す', why: '高いのではなく、範囲が伝わっていないことが多いです。', roleId: 'strategist' },
  ],
};

/** その段で直せること（2つまで）。 */
export function fixOptions(stageId) {
  return FIXES[stageId] || FIXES.reach;
}

/** 選んだ直し方（id から引く）。 */
export function fixById(id) {
  for (const list of Object.values(FIXES)) {
    const hit = list.find((f) => f.id === id);
    if (hit) return hit;
  }
  return null;
}

// ── アプリの数字を、依頼文に組み立てる（AIは呼ばない）──

/** 収益導線のいまの状態を、社員に読ませる形の数行にする。 */
export function numbersBlock(funnel) {
  const f = normalizeFunnel(funnel);
  const entry = latestEntry(f);
  if (!entry) return ['## いまの数字', '- まだ記録がありません。'].join('\n');
  const stats = stageStats(entry);
  const lines = ['## いまの数字（直近の1週）'];
  for (const s of stats) {
    const stage = stageById(s.stageId);
    const rate = s.rate === null ? '' : `／前の段の ${pct(s.rate)}`;
    lines.push(`- ${labelOf(f, s.stageId)}：${s.value}${stage ? stage.metric : '人'}${rate}`);
  }
  const b = bottleneck(entry);
  if (b) lines.push(`- **詰まっているのは「${labelOf(f, b.stageId)}」**（${b.reason}）`);
  return lines.join('\n');
}

/**
 * その段でAI社員に投げる依頼文。**AIを呼ばずに組み立てる。**
 * @returns {{request:string, roleId:string|null, workflowId:string|null}|null}
 *          AIを呼ばない段（human / app）なら null。
 */
export function loopRequest(loop, { venture = null, funnel = null, plan = null, unit = null } = {}) {
  const step = stepOf(loop);
  if (!step || step.kind !== 'ai') return null;
  const f = normalizeFunnel(funnel);
  const title = venture ? venture.title : 'この事業';
  const head = [`「${title}」の${LOOP_MODES[loop.mode].name} ${loop.n}周目です。`, ''];

  if (loop.mode === 'ooda' && step.id === 'act') {
    const fix = fixById(loop.decision);
    const stageName = loop.decisionStage ? labelOf(f, loop.decisionStage) : '詰まっている段';
    return {
      roleId: fix ? fix.roleId : 'creator',
      workflowId: null,
      request: [
        ...head,
        `詰まっているのは「${stageName}」で、直すと決めたのは **${fix ? fix.label : loop.decision}** です。`,
        '',
        numbersBlock(f),
        '',
        '## お願いすること',
        `${fix ? fix.label : loop.decision}ための、そのまま使える成果物を作ってください。`,
        '- 説明ではなく、現物（文面・見出し・手順）を書いてください。',
        '- 直すのはこの1つだけです。ほかの段には手をつけないでください。',
        '- 1週間で試せる大きさにしてください。',
      ].join('\n'),
    };
  }

  if (loop.mode === 'pdca' && step.id === 'plan') {
    const goal = venture && venture.goalMonthlyJpy ? `${venture.goalMonthlyJpy.toLocaleString('ja-JP')}円` : '目標額';
    const price = venture && venture.priceJpy ? `${venture.priceJpy.toLocaleString('ja-JP')}円` : '単価';
    const need = plan && plan.ready ? `${plan.needBuyers}人` : '不明';
    return {
      roleId: 'strategist',
      workflowId: null,
      request: [
        ...head,
        `月${goal}が目標で、単価は${price}。逆算では買う人が${need}必要です。`,
        '',
        numbersBlock(f),
        '',
        '## お願いすること',
        '今月やることを、次の形で組んでください。',
        '- やることは**3つまで**。多いと全部中途半端になります。',
        '- それぞれに「どの数字が、いくつになったら成功か」を書いてください。',
        '- 手元にない数字は推測せず、「これを測ってください」と書いてください。',
        '- 最後に「今月これだけはやる1つ」を選んでください。',
      ].join('\n'),
    };
  }

  if (loop.mode === 'pdca' && step.id === 'act') {
    // **動いていないものを「赤字」と書かない。** 売上も費用も0なら、
    // まだ計算できないだけ（`unit.black` は 0>0 が false になるので判定に使えない）。
    const moved = unit && (unit.earned > 0 || unit.aiCost > 0);
    const money = !moved
      ? 'まだお金も費用も動いていないので、計算できません'
      : unit.black
        ? `稼ぎがAI費用を上回っています（1円あたり${unit.ratio}円）`
        : 'まだAI費用のほうが多い状態です';
    return {
      roleId: 'analytics',
      workflowId: 'numbers',
      request: [
        ...head,
        '今月の結果を見て、来月に直すことを決めたいです。',
        '',
        numbersBlock(f),
        `- 採算：${money}`,
        '',
        '## お願いすること',
        '- いちばん低い数字を**1つだけ**選び、なぜそこかを書いてください。',
        '- その1つを直すために、来月やることを最大3つ挙げてください。',
        '- それぞれ「どの数字がどうなったら成功か」を必ず書いてください。',
        '- 手元にない数字は推測せず、「これを測ってください」と書いてください。',
      ].join('\n'),
    };
  }
  return null;
}

/**
 * 画面に出す1行。
 * **回った周が既にある時に「まだ1周も回していません」と言わない**
 * （履歴の件数と食い違って見える）。
 */
export function loopLine(loop, funnel, doneCount = 0) {
  if (!loop) {
    return doneCount > 0
      ? `前の周は終わりました。${doneCount + 1}周目を始められます。`
      : 'まだ1周も回していません。観察から始めます。';
  }
  const step = stepOf(loop);
  const m = LOOP_MODES[loop.mode];
  if (loop.closedAt) return `${m.name} ${loop.n}周目は終わりました。次の周を始められます。`;
  if (!step) return '';
  const i = stepIndex(loop) + 1;
  const total = stepsOf(loop.mode).length;
  return `${m.name} ${loop.n}周目・${i}/${total}「${step.name}」。${step.what}`;
}

/** 情勢判断（Orient）でアプリが出す答え。**AIを呼ばない。** */
export function orientResult(funnel) {
  const f = normalizeFunnel(funnel);
  const entry = latestEntry(f);
  if (!entry) {
    return { ready: false, stageId: null, label: '', reason: '収益導線に数字がまだありません。観察に戻ってください。', options: [] };
  }
  const b = bottleneck(entry);
  if (!b) return { ready: false, stageId: null, label: '', reason: '判定できませんでした。', options: [] };
  return {
    ready: true,
    stageId: b.stageId,
    label: labelOf(f, b.stageId),
    reason: b.reason,
    options: fixOptions(b.stageId),
  };
}

/** 段の並び（画面で4つ並べるため）。 */
export function loopStages(loop) {
  const steps = stepsOf(loop ? loop.mode : 'ooda');
  const cur = loop ? stepIndex(loop) : -1;
  return steps.map((s, i) => ({ ...s, state: loop && loop.closedAt ? 'done' : i < cur ? 'done' : i === cur ? 'now' : 'todo' }));
}
