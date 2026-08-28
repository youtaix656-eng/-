// 受け入れ確認——**人がやるテスト。**
//
// 完成条件の確認（`checks.js`）はAI社員がやっているが、
// **自分たちが作ったものを自分たちで採点すると甘くなる。**
// 作る値段が下がったぶん、詰まるのは上流（要件）と下流（テスト）で、
// 「確かめる人」の重みが上がっている——ここはAIに任せきらない。
//
// 決まりごと：
//  ・**AIを呼ばない。** 人が○×を付けるだけ（費用ゼロ）。
//  ・**AIの答えで人の欄を埋めない。** 埋めると「見たつもり」になる。
//  ・**食い違いを隠さない。** AIが○で人が×のところが、いちばん見たい所。
//  ・**通せない関門にしない。** 全部付けなくても、共有も知識化もできる。
//  ・完成条件を決めていない仕事には出さない（付ける対象が無いので）。

import { parseChecklist, checkSummary } from './checks.js';

export const ACCEPT_VALUES = {
  ok: 'できている',
  ng: 'できていない',
};

/**
 * 受け入れ確認の状態。
 * @returns {{items:object[], total:number, done:number, ng:number,
 *            disagree:object[], state:'none'|'todo'|'doing'|'passed'|'failed'}}
 */
export function acceptReview(task) {
  const items0 = parseChecklist(task && task.spec && task.spec.doneWhen);
  if (!items0.length) return { items: [], total: 0, done: 0, ng: 0, disagree: [], state: 'none' };

  const ai = checkSummary(task);
  const human = (task && task.accept) || {};

  const items = items0.map((text, i) => {
    const a = ai.items[i];
    const h = human[String(i)] || null;
    return {
      i,
      text,
      // AIの答え（読み取れていれば true/false、読み取れなければ null）
      ai: a ? Boolean(a.ok) : null,
      aiReason: (a && a.reason) || '',
      // 人の答え。**AIの答えで埋めない。**
      human: h && ACCEPT_VALUES[h.value] ? h.value : null,
      note: (h && h.note) || '',
      at: (h && h.at) || 0,
    };
  });

  const done = items.filter((x) => x.human).length;
  const ng = items.filter((x) => x.human === 'ng').length;
  // AIが「できている」と言ったのに、人が「できていない」と付けたもの（逆も）
  const disagree = items.filter((x) => x.human && x.ai !== null && (x.ai ? x.human === 'ng' : x.human === 'ok'));

  let state = 'todo';
  if (done && done < items.length) state = 'doing';
  else if (done === items.length) state = ng ? 'failed' : 'passed';

  return { items, total: items.length, done, ng, disagree, state };
}

/** 人の答えを1つ書き込んだ後の `task.accept`。同じ答えをもう一度押したら外す。 */
export function setAccept(task, index, value, note = '', now = Date.now()) {
  const cur = { ...((task && task.accept) || {}) };
  const key = String(index);
  const prev = cur[key];
  if (prev && prev.value === value && !note) {
    delete cur[key];
    return cur;
  }
  cur[key] = { value: ACCEPT_VALUES[value] ? value : 'ok', note: String(note || '').slice(0, 200), at: now };
  return cur;
}

/** 画面に出す1行。 */
export function acceptLine(review) {
  if (!review || review.state === 'none') return '';
  switch (review.state) {
    case 'todo':
      return `${review.total}つの条件を、自分の目で確かめてください。AIの確認とは別に持っています。`;
    case 'doing':
      return `${review.done}／${review.total}まで確かめました。`;
    case 'passed':
      return `${review.total}つとも、自分の目で確かめました。`;
    case 'failed':
      return `${review.ng}つ、できていないところがあります。手順を戻してやり直せます。`;
    default:
      return '';
  }
}

/** 食い違いの1行（AIが甘く見ていた所）。無ければ空。 */
export function disagreeLine(review) {
  if (!review || !review.disagree.length) return '';
  const n = review.disagree.length;
  return `AIの確認と、あなたの答えが${n}つ食い違っています。AIは自分たちの成果を採点しているので、こちらが正です。`;
}
