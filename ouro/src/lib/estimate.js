// 実行する前に「およそいくらか」を出す。
//
// これまで画面に出ていたのは「AIを呼ぶ 4回」という**回数だけ**で、
// 金額はやってみるまで分からなかった。24時間回すと1か月で数十万〜数百万に
// なりうる世界なので、**押す前に円で見えている**必要がある。
//
// **当てずっぽうを断定で書かない。** 実際の長さは依頼と材料で変わるので、
// ここが返すのは「目安」であり、画面にもそう書く。

import { estimateCost } from './providers/index.js';
import { route } from './router.js';

/**
 * 1回の呼び出しで出入りするトークンの目安。
 * 入力＝会社の決まり＋現在地＋材料＋依頼、出力＝成果物1本ぶん。
 * **実測ではなく目安**なので、増やす時はここだけを直す。
 */
export const AVG_INPUT_TOKENS = 3000;
export const AVG_OUTPUT_TOKENS = 1200;

/** 目安の幅（0.5倍〜2倍）。1つの数字だけ出すと、外れた時に嘘になる。 */
export const RANGE = { low: 0.5, high: 2 };

/**
 * 手順ごとに、いまの設定だとどのエンジンに回るかを見て費用を足す。
 *
 * @param {object} o
 * @param {{roleId:string}[]} o.steps  実行する手順（入れ子は平らにして渡す）
 * @param {(roleId:string)=>object|null} o.employeeFor 役職から担当を引く
 * @param {object} o.secrets / o.settings / o.request
 * @returns {{calls, usd, usdLow, usdHigh, jpy, rows, free}}
 */
export function estimateRun({ steps = [], employeeFor = () => null, secrets = {}, settings = {}, request = '' } = {}) {
  const flat = steps.flat ? steps.flat(2) : steps;
  const rows = [];
  let usd = 0;

  for (const step of flat) {
    if (!step) continue;
    const employee = employeeFor(step.roleId) || { roleId: step.roleId };
    const decision = route({
      employee,
      secrets,
      settings,
      request: `${request} ${step.instruction || ''}`,
      mode: settings.routerMode || 'auto',
      costMode: settings.costMode || 'auto',
    });
    const cost = estimateCost(decision.providerId, decision.model, {
      input: AVG_INPUT_TOKENS,
      output: AVG_OUTPUT_TOKENS,
    });
    usd += cost;
    rows.push({ roleId: step.roleId, providerId: decision.providerId, model: decision.model, usd: cost });
  }

  const jpyRate = Number(settings.usdJpy) || 155;
  return {
    calls: rows.length,
    usd,
    usdLow: usd * RANGE.low,
    usdHigh: usd * RANGE.high,
    jpy: Math.round(usd * jpyRate),
    jpyLow: Math.round(usd * RANGE.low * jpyRate),
    jpyHigh: Math.round(usd * RANGE.high * jpyRate),
    rows,
    // 費用のかからないエンジン（ローカル社員・ローカルAI）だけで回る
    free: usd === 0,
  };
}

/** 画面に出す1行。**必ず「目安」と書く。** */
export function estimateLine(est) {
  if (!est || !est.calls) return '';
  if (est.free) return `AIを${est.calls}回呼びます（費用のかからないエンジンのみ）`;
  if (est.jpyHigh < 1) return `AIを${est.calls}回呼びます（1円未満の目安）`;
  return `AIを${est.calls}回呼びます（およそ${est.jpyLow}〜${est.jpyHigh}円の目安）`;
}

/** 今月の上限まであといくらか。上限なしなら null。 */
export function remainingThisMonth(settings = {}) {
  const cap = Number(settings.monthlyCapUsd) || 0;
  if (cap <= 0) return null;
  return Math.max(0, cap - (Number(settings.costMonthUsd) || 0));
}
