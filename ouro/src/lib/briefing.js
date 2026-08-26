// 会議の事前配布（新規）。
//
// これまで会議に渡していたのは `topic` の1行だけだった。
// **同じ材料を読んでいない会議は、ただの雑談になる。**
// 台帳・収益導線・掲示板から材料を作って、参加者全員に先に読ませる。
//
// AIは1回も呼ばない（材料を組み立てるだけ）。増えるのは入力ぶんだけ。

import { buildLedger, todayFocus } from './ledger.js';
import { latestEntry, stageStats, bottleneck, labelOf, pct } from './funnel.js';
import { livePosts, kindById } from './board.js';

export const MAX_BRIEF = 1800;

/**
 * 会議の材料。
 * @param {object} o {tasks, deals, funnel, board, now}
 */
export function buildBriefing({ tasks = [], deals = [], funnel = null, board = [], now = Date.now() } = {}) {
  const parts = [];

  const rows = buildLedger(tasks, { deals, now });
  const focus = todayFocus(rows);
  const open = rows.filter((r) => r.state !== 'done' && r.state !== 'cancelled');
  if (open.length) {
    parts.push(
      [
        '## いま動いている仕事',
        ...open.slice(0, 8).map((r) => `- 「${r.title}」${r.owner ? `（${r.owner}）` : ''}／${r.stateName}${r.dueAt ? `／期限 ${new Date(r.dueAt).toLocaleDateString('ja-JP')}` : ''}`),
      ].join('\n')
    );
  }
  if (focus.total) {
    const bits = [];
    if (focus.overdue.length) bits.push(`期限切れ ${focus.overdue.length}件`);
    if (focus.today.length) bits.push(`今日まで ${focus.today.length}件`);
    if (focus.decisions.length) bits.push(`あなたの判断待ち ${focus.decisions.length}件`);
    if (focus.stopped.length) bits.push(`止まっている ${focus.stopped.length}件`);
    parts.push(`## 手当てが要るもの\n- ${bits.join('／')}`);
  }

  const entry = funnel ? latestEntry(funnel) : null;
  if (entry) {
    const neck = bottleneck(entry);
    parts.push(
      [
        '## 収益導線（直近の週）',
        ...stageStats(entry).map(
          (x) => `- ${labelOf(funnel, x.stageId)}：${x.value}人${x.rate === null ? '' : `（通過率 ${pct(x.rate)}）`}`
        ),
        neck ? `いま詰まっているのは「${labelOf(funnel, neck.stageId)}」（${neck.reason}）` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  const posts = livePosts(board, now).slice(0, 6);
  if (posts.length) {
    parts.push(
      ['## 社内で共有されていること', ...posts.map((p) => `- 【${kindById(p.kind).name}】${p.employeeName ? `${p.employeeName}：` : ''}${p.text}`)].join('\n')
    );
  }

  const text = parts.join('\n\n');
  return text.length > MAX_BRIEF ? `${text.slice(0, MAX_BRIEF)}\n…（以下省略）` : text;
}

/** 週次レビューの議題（週の始まりを入れる）。 */
export function weeklyTopic(now = Date.now()) {
  const d = new Date(now);
  return `${d.getMonth() + 1}月${d.getDate()}日までの1週間の振り返り：できたこと・詰まっていること・来週やる1つ`;
}

/** 週次レビューで必ず答えてほしいこと。 */
export function weeklyPrompt() {
  return [
    '今週の振り返りです。次の3つに、この順で答えてください。',
    '1. できたこと（数字か、出来上がったものだけを挙げる。感想は書かない）',
    '2. 詰まっていること（誰の手が要るかまで書く）',
    '3. 来週やる1つ（複数書かない。どの数字がどうなったら成功かを添える）',
    '配られた材料に無いことは、推測で書かないでください。',
  ].join('\n');
}
