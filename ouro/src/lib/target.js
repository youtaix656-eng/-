// 逆算——「月◯円」から、収益導線の各段に何人必要かを出す。
//
// 動画（AI社員で事業を立ち上げる）でいちばん実務的だったのがここ。
//   月10万円 ÷ 単価1,980円 = 51人 → いまの通過率で割り戻すと、
//   集める段には何人必要か。
//
// **手元に無い基準は持たない**（収益導線と同じ）。使うのは
//  ①自分で決めた目標と単価 ②自分の直近の通過率 だけ。
// 通過率が分かっていない段は、埋めずに「まだ分かりません」と返す。

import { FUNNEL_STAGES, stageStats, labelOf, stageById } from './funnel.js';

/**
 * @param {object} o
 * @param {object} o.venture 事業（priceJpy / goalMonthlyJpy を見る）
 * @param {object} o.entry   収益導線の最新の週（無ければ通過率は不明）
 * @param {object} o.funnel  段の表示名を出すため
 * @returns {{price, goal, needBuyers, rows, unknown, ready}}
 */
export function targetPlan({ venture, entry = null, funnel = null } = {}) {
  const price = Number(venture?.priceJpy) || 0;
  const goal = Number(venture?.goalMonthlyJpy) || 0;
  const ready = price > 0 && goal > 0;
  if (!ready) {
    return { price, goal, needBuyers: 0, rows: [], unknown: [], ready: false };
  }

  const needBuyers = Math.ceil(goal / price);
  const stats = stageStats(entry);
  const byId = Object.fromEntries(stats.map((s) => [s.stageId, s]));

  // 後ろ（買ってもらう）から前へ割り戻す。
  // **通過率が分からない段から先は、埋めずに null にする。**
  // 1と置くと「前の段も同じ人数でよい」という嘘になる。
  const rows = [];
  let need = needBuyers;
  for (let i = FUNNEL_STAGES.length - 1; i >= 0; i -= 1) {
    const stage = FUNNEL_STAGES[i];
    const st = byId[stage.id] || null;
    const now = st ? st.value : 0;
    rows.unshift({
      stageId: stage.id,
      label: funnel ? labelOf(funnel, stage.id) : stage.name,
      metric: stage.metric,
      need,
      now,
      rate: st ? st.rate : null,
      gap: need === null ? null : Math.max(0, need - now),
    });
    if (i === 0) break;
    if (need === null) continue;
    // rate は「1つ前の段 → この段」の通過率
    const rate = st && st.rate !== null && st.rate > 0 ? st.rate : null;
    need = rate === null ? null : Math.ceil(need / rate);
  }

  const unknown = rows.filter((r) => r.need === null).map((r) => r.stageId);

  return { price, goal, needBuyers, rows, unknown, ready: true };
}

/** 逆算の結果を1行の文章にする（ホームや事業カードで使う）。 */
export function targetLine(plan) {
  if (!plan || !plan.ready) return '目標額と単価を入れると、必要な人数を出します。';
  const first = plan.rows[0];
  if (!first || first.need === null || !first.need) {
    return `月${plan.goal.toLocaleString('ja-JP')}円なら、買ってくれる人が${plan.needBuyers}人。通過率がまだ分からないので、そこから先は数字が貯まってから。`;
  }
  return `月${plan.goal.toLocaleString('ja-JP')}円＝買う人${plan.needBuyers}人。いまの通過率だと${first.label}に${first.need.toLocaleString('ja-JP')}人必要です。`;
}

/** 分析担当への依頼文（AIを呼ぶのは人が押した時だけ）。 */
export function targetRequest(venture, plan, funnel) {
  if (!plan || !plan.ready) return '';
  const lines = [
    `「${venture.title}」で月${plan.goal.toLocaleString('ja-JP')}円にしたいです。単価は${plan.price.toLocaleString('ja-JP')}円です。`,
    '',
    '## いまの数字と、必要な数字',
    ...plan.rows.map((r) => {
      const label = funnel ? labelOf(funnel, r.stageId) : stageById(r.stageId)?.name || r.stageId;
      const need = r.need ? `${r.need}人必要` : '必要数は不明（通過率が出ていません）';
      return `- ${label}：いま ${r.now}人 → ${need}`;
    }),
    '',
    '## お願い',
    '差がいちばん大きい段を1つだけ選び、そこを埋めるために今週やることを3つまでで書いてください。',
    '手元にない数字（業界平均など）を根拠にしないでください。',
  ];
  return lines.join('\n');
}
