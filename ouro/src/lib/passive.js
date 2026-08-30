// 手離れ（不労所得を、言葉ではなく数字で見る）。
//
// 「不労所得」は**作るまでは労働**で、**作ったあと更新しなくても回る**もの。
// つまり「不労かどうか」は気持ちではなく、次の2つで測れる：
//   ① 最後に手を入れてから何日たったか
//   ② そのあいだにお金が入ったか
//
// 決まりごと：
//  ・**AIを呼ばない。** 仕事・発信・案件の日付から毎回導くだけ。
//  ・**「手を入れた」に入金の記録を数えない。** 入金を数えると、売れるたびに
//    日数が0に戻り、不労所得は永久に測れなくなる（依頼した・出した・案件を
//    起こした＝自分の手が動いたものだけを数える）。
//  ・**事業の編集（updatedAt）も数えない。** 説明文を直しただけで
//    「また働いた」ことにすると、この画面を見に来るだけで数字が壊れる。
//  ・**業界平均のような手元に無い基準を持たない。** 比べるのは自分の数字だけ。

import { EARNED_STATUS } from './revenue.js';

const DAY = 86400000;

/** 何日ぶん手を離したら「手を止めている」と見るか。 */
export const REST_DAYS = 7;

/**
 * この事業に最後に手を入れた時刻。
 * 依頼した（task.createdAt）・出した（post.postedAt）・案件を起こした（deal.createdAt）。
 * 0 は「まだ一度も手を入れていない」。
 */
export function lastTouchedAt(venture, { tasks = [], posts = [], deals = [] } = {}) {
  if (!venture) return 0;
  let last = 0;
  for (const t of tasks) {
    if (t.ventureId === venture.id) last = Math.max(last, Number(t.createdAt) || 0);
  }
  for (const p of posts) {
    if (p.ventureId === venture.id) last = Math.max(last, Number(p.postedAt) || Number(p.createdAt) || 0);
  }
  for (const d of deals) {
    if (d.ventureId === venture.id) last = Math.max(last, Number(d.createdAt) || 0);
  }
  return last;
}

/** ある時点より後に入ったお金（入金済みの案件だけ）。 */
export function earnedSince(venture, deals = [], since = 0) {
  if (!venture || !since) return 0;
  return deals
    .filter((d) => d.ventureId === venture.id && EARNED_STATUS.includes(d.status))
    .filter((d) => (Number(d.paidAt) || 0) >= since)
    .reduce((s, d) => s + (Number(d.fee) || 0), 0);
}

/**
 * 手離れの状態。
 *  none     … まだ一度も手を入れていない
 *  building … 作っている最中（手を離してから REST_DAYS 未満）
 *  resting  … 手を止めているが、そのあいだお金は入っていない
 *  passive  … 手を止めているあいだにお金が入った（＝ここではじめて不労所得）
 */
export function passiveState({ venture, tasks = [], posts = [], deals = [], now = Date.now() } = {}) {
  if (!venture) return null;
  const last = lastTouchedAt(venture, { tasks, posts, deals });
  if (!last) {
    return { state: 'none', last: 0, days: 0, earned: 0, rested: Boolean(venture.restedAt) };
  }
  const days = Math.floor((now - last) / DAY);
  const earned = earnedSince(venture, deals, last);
  const state = days < REST_DAYS ? 'building' : earned > 0 ? 'passive' : 'resting';
  return { state, last, days, earned, rested: Boolean(venture.restedAt) };
}

/** 画面に出す1行。断定しない（数えているのは自分の記録だけなので）。 */
export function passiveLine(p) {
  if (!p) return '';
  switch (p.state) {
    case 'none':
      return 'まだ手を入れた記録がありません。依頼・発信・案件のどれかを入れると数え始めます。';
    case 'building':
      return `最後に手を入れてから${p.days}日。まだ作っている最中です（作るまでは労働です）。`;
    case 'resting':
      return `${p.days}日、手を入れていません。そのあいだに入ったお金は0円でした。`;
    case 'passive':
      return `${p.days}日、手を入れていません。そのあいだに${p.earned.toLocaleString('ja-JP')}円が入りました。`;
    default:
      return '';
  }
}

// ── 仕上げ線（ここで手を止める）──
//
// 動画でいう「ラスボス」＝**もっと稼げるかもしれない、で手を止められないこと。**
// やめる基準（verdict.js）は「伸びなかった時に降りる線」で、こちらは
// **伸びた時に手を止める線**。層が違うので別に持つ。
//
// 決めるのは1行だけ（`venture.finishWhen`）。届いたと思ったら
// `restedAt` を立てて「ここで手を止めた」と記録する。**判定はしない**
// ——届いたかどうかを機械が決めると、決めたはずの線をアプリが上書きしてしまう。

/** 仕上げ線をまだ書いていない／届いたかもしれない時に出す一言。 */
export function finishNudge(venture, p) {
  if (!venture || !p) return '';
  if (venture.restedAt) {
    // 手を止めたあとも、**決めた線は消さずに見せる**
    // （何をもって止めたのかが残っていないと、次に触る判断ができない）。
    const line = venture.finishWhen ? `（決めた線：「${venture.finishWhen}」）` : '';
    return `「ここで手を止める」と決めた事業です${line}。次に触るのは、あなたが決めた時だけ。`;
  }
  if (!venture.finishWhen) {
    return '「ここまで出来たら手を止める」を1行だけ決めておくと、伸びた時に増やし続けずに済みます。';
  }
  if (p.state === 'passive' || p.state === 'resting') {
    return `決めた線：「${venture.finishWhen}」。届いていれば、ここで手を止めてかまいません。`;
  }
  return `決めた線：「${venture.finishWhen}」`;
}
