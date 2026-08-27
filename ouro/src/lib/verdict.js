// 撤退・継続の基準。
//
// 「10日フルコミットして、ダメなら次へ」という進め方は、
// **やめる基準を先に書いていないと、ただの惰性になる。**
// お金が無いときに一番効くのは、続ける勇気ではなく降りる線引きなので、
// 事業を始める前に「いつまでに・何が・いくつ」を書かせる。
//
// AIを呼ばない。判定は収益導線の数字と日付だけで出す。

import { FUNNEL_STAGES, stageById, latestEntry, normalizeFunnel } from './funnel.js';
import { dayIndex, daysLeft } from './venture.js';

/** 基準にできるもの＝収益導線の4段。売上そのものではなく人数で見る。 */
export const VERDICT_METRICS = FUNNEL_STAGES.map((s) => ({ id: s.id, name: s.name, metric: s.metric }));

/**
 * いまの状態。
 *  none    … 基準がまだ無い
 *  waiting … 始まっていない
 *  running … 期間の途中で、まだ届いていない
 *  met     … 期間の途中でも、もう届いた（続けてよい）
 *  due     … 期間が終わって、届かなかった（あなたの判断待ち）
 *  decided … 判断済み
 */
export function verdictStatus(venture, funnel, now = Date.now()) {
  if (!venture) return null;
  const v = venture.verdict || {};
  const target = Number(v.target) || 0;
  const stage = stageById(v.metric);
  if (!target || !stage) return { state: 'none', target, stage: null, current: 0 };
  if (v.decidedAt) {
    return { state: 'decided', target, stage, current: currentValue(funnel, v.metric), decision: v.decision };
  }
  if (!venture.startedAt) return { state: 'waiting', target, stage, current: 0 };

  const current = currentValue(funnel, v.metric);
  const left = daysLeft(venture, now);
  if (current >= target) {
    return { state: 'met', target, stage, current, left, day: dayIndex(venture, now) };
  }
  if (left !== null && left <= 0) {
    return { state: 'due', target, stage, current, left, day: dayIndex(venture, now) };
  }
  return { state: 'running', target, stage, current, left, day: dayIndex(venture, now) };
}

/** 最新の週の、その段の人数。 */
export function currentValue(funnel, metricId) {
  const entry = latestEntry(normalizeFunnel(funnel));
  if (!entry) return 0;
  return Number(entry.values?.[metricId]) || 0;
}

/** 判断を書き込む（続ける／やめる／延長）。延長だけは判断を残さず期間を伸ばす。 */
export function applyDecision(venture, decision, extraDays = 14, now = Date.now()) {
  if (!venture) return venture;
  if (decision === 'extend') {
    return { ...venture, days: (venture.days || 0) + Math.max(1, extraDays), updatedAt: now };
  }
  const verdict = { ...(venture.verdict || {}), decidedAt: now, decision };
  const state = decision === 'stop' ? 'stopped' : 'keep';
  return { ...venture, verdict, state, updatedAt: now };
}

/** 画面に出す1行。 */
export function verdictLine(status) {
  if (!status) return '';
  const name = status.stage ? status.stage.metric : '';
  switch (status.state) {
    case 'none':
      return 'やめる基準がまだありません。始める前に決めておくと、続けるか迷わなくて済みます。';
    case 'waiting':
      return `基準：${name} ${status.target}人。始めると日数を数え始めます。`;
    case 'running':
      return `${name} ${status.current}／${status.target}人。残り${status.left}日。`;
    case 'met':
      return `${name}が${status.current}人になり、基準（${status.target}人）に届きました。続ける理由があります。`;
    case 'due':
      return `期間が終わりました。${name}は${status.current}人で、基準の${status.target}人に届いていません。続けるか、やめるかを決めてください。`;
    case 'decided':
      return status.decision === 'stop' ? 'やめると決めた事業です。' : '続けると決めた事業です。';
    default:
      return '';
  }
}
