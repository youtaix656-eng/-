// 収益導線（新規）。
//
// **作業を自動化できる＝収益が増える、ではない。**
// Ouro は依頼すると即座に何人ものAI社員が動くので、向きがズレていると
// ズレた方向へ速く進んでしまう。地図（どこで詰まっているか）を先に持つための層。
//
// 案件（lib/revenue.js）は「1件いくらで受けたか」の記録で、これは別物——
// **人がどこで減っているか**を見る。
//
// 数字はユーザーが手で入れる（端末内保存のみ・外へ送らない）。
// 自動で取れない数字を取れるふりはしない。

import { makeFunnel, normalizeFunnel } from './funnelShape.js';

/**
 * 4段。名前は商売の形で変わるので、表示名は変えられる。
 * ただし**段の数と順番は固定**（増やすと「どこが詰まっているか」が見えにくくなる）。
 */
export const FUNNEL_STAGES = [
  {
    id: 'reach',
    name: '集める',
    metric: '見た人',
    glyph: '◍',
    roleId: 'marketer',
    desc: '知ってもらう。SNS・検索・紹介など。',
    ask: '今週、あなたの発信を見た人はおよそ何人ですか',
  },
  {
    id: 'read',
    name: '読ませる',
    metric: '読んだ人',
    glyph: '▤',
    roleId: 'writer',
    desc: '中身を読んでもらう。記事・プロフィール・固定投稿。',
    ask: 'そのうち、記事やプロフィールまで読んだ人は何人ですか',
  },
  {
    id: 'lead',
    name: '登録・問い合わせ',
    metric: '登録した人',
    glyph: '✉',
    roleId: 'contentmarketer',
    desc: '連絡先を残してもらう。LINE・メール・DM・予約。',
    ask: 'そのうち、登録や問い合わせをした人は何人ですか',
  },
  {
    id: 'sale',
    name: '買ってもらう',
    metric: '買った人',
    glyph: '¥',
    roleId: 'sales',
    desc: '払ってもらう。施術・note・受注。',
    ask: 'そのうち、実際に買った（申し込んだ）人は何人ですか',
  },
];

export function stageById(id) {
  return FUNNEL_STAGES.find((s) => s.id === id) || null;
}

// 入れ物の形は funnelShape.js にある（起動時に読む量を増やさないための切り出し）。
// ここからも再輸出するので、画面側の import は今までどおりでよい。
export { makeFunnel, normalizeFunnel } from './funnelShape.js';

export function labelOf(funnel, stageId) {
  const f = normalizeFunnel(funnel);
  return f.labels[stageId] || stageById(stageId)?.name || stageId;
}

/** 週の始まり（月曜 0時）にそろえる。 */
export function startOfWeek(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 月曜=0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function latestEntry(funnel) {
  const f = normalizeFunnel(funnel);
  return f.entries.length ? f.entries[f.entries.length - 1] : null;
}

/**
 * 段ごとの通過率。1段目は母数が無いので rate は null。
 * @returns {{stageId, value, prev, rate, drop}[]}
 */
export function stageStats(entry) {
  if (!entry) return [];
  const out = [];
  let prev = null;
  for (const s of FUNNEL_STAGES) {
    const value = Number(entry.values?.[s.id]) || 0;
    const rate = prev === null ? null : prev > 0 ? value / prev : null;
    out.push({ stageId: s.id, value, prev, rate, drop: prev === null ? 0 : Math.max(0, prev - value) });
    prev = value;
  }
  return out;
}

/**
 * どこが詰まっているか。
 *
 * **「業界の平均」を持たない。** 手元に無い基準を作ると、根拠のない数字で
 * 判断させることになる。見るのは自分の数字の中の相対だけ：
 *   ・0 の段があれば、いちばん手前の 0 がボトルネック（そこで止まっている）
 *   ・そうでなければ、通過率がいちばん低い段
 */
export function bottleneck(entry) {
  const stats = stageStats(entry);
  if (!stats.length || stats[0].value === 0) {
    return stats.length ? { stageId: 'reach', reason: 'まだ人が来ていません', stats } : null;
  }
  const zero = stats.find((x) => x.prev !== null && x.value === 0);
  if (zero) {
    return { stageId: zero.stageId, reason: 'ここで全員いなくなっています', stats };
  }
  const withRate = stats.filter((x) => x.rate !== null);
  if (!withRate.length) return { stageId: 'reach', reason: '次の段の数字がまだありません', stats };
  const worst = withRate.reduce((a, b) => (b.rate < a.rate ? b : a));
  return { stageId: worst.stageId, reason: `通過率がいちばん低い段です（${pct(worst.rate)}）`, stats };
}

export function pct(rate) {
  if (rate === null || rate === undefined) return '—';
  return `${(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}%`;
}

/** 前の週との差（増えた／減った／変わらない）。 */
export function weekChange(funnel) {
  const f = normalizeFunnel(funnel);
  const n = f.entries.length;
  if (n < 2) return null;
  const now = f.entries[n - 1];
  const before = f.entries[n - 2];
  const rows = FUNNEL_STAGES.map((s) => {
    const a = Number(before.values?.[s.id]) || 0;
    const b = Number(now.values?.[s.id]) || 0;
    return { stageId: s.id, before: a, now: b, diff: b - a };
  });
  return { now, before, rows };
}
