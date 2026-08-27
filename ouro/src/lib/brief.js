// 会社の現在地（1枚）。
//
// Sierra（AIエージェントの会社）は、社員ごとにエージェントを配ったら回らず、
// **1つの大きなエージェントに会社のコンテキストを持たせて全員がそこへ話しかける**
// 形にしたらうまくいった、という話がある。Ouro でも同じことが起きていた——
// 社員ごとに材料を組み立てているのに、**「会社がいまどこにいるか」は誰も知らない**。
//
// ここはその1枚。役割より先に読ませる。
// **AIを呼ばない**（全部その場の計算で作る）。短さが命なので上限を持つ。

import { activeVenture, dayIndex, daysLeft } from './venture.js';
import { verdictStatus, verdictLine } from './verdict.js';
import { latestEntry, normalizeFunnel, stageStats, labelOf, pct } from './funnel.js';
import { recentDecisions } from './decisions.js';

/** プロンプトに入れる上限。ここが長いと毎回の料金に効く。 */
export const BRIEF_LIMIT = 700;

/**
 * @returns {string} 空なら何も渡さない（まだ何も始まっていない会社に嘘を書かない）
 */
export function companyBrief({
  company = null,
  ventures = [],
  funnel = null,
  tasks = [],
  approvals = [],
  settings = {},
  now = Date.now(),
} = {}) {
  const lines = [];

  const venture = activeVenture(ventures);
  if (venture) {
    const who = [venture.who && `${venture.who}に`, venture.what].filter(Boolean).join('');
    const price = venture.priceJpy ? `${venture.priceJpy.toLocaleString('ja-JP')}円` : '';
    lines.push(
      `- いま進めている事業：「${venture.title}」${who ? `（${who}${price ? `／${price}` : ''}）` : ''}` +
        (venture.startedAt ? `　${dayIndex(venture, now)}日目／全${venture.days}日（残り${daysLeft(venture, now)}日）` : '')
    );
    if (venture.hypothesis) lines.push(`- 立てている仮説：${venture.hypothesis}`);
    const st = verdictStatus(venture, funnel, now);
    if (st && st.state !== 'none') lines.push(`- やめる基準：${verdictLine(st)}`);
  }

  const entry = latestEntry(normalizeFunnel(funnel));
  if (entry) {
    const nums = stageStats(entry)
      .map((x) => `${labelOf(funnel, x.stageId)} ${x.value}人${x.rate === null ? '' : `（${pct(x.rate)}）`}`)
      .join('／');
    lines.push(`- 直近の数字：${nums}`);
  }

  const waiting = tasks.filter((t) => t.status === 'awaiting_approval').length;
  const pending = approvals.filter((a) => a.status === 'pending').length;
  const decisions = tasks.reduce(
    (n, t) => n + ((t.decisions || []).filter((d) => !d.decidedAt).length),
    0
  );
  if (waiting || pending || decisions) {
    lines.push(
      `- オーナー待ち：承認${pending}件・判断${decisions}件${waiting ? `・承認待ちの仕事${waiting}件` : ''}`
    );
  }

  const recent = recentDecisions(tasks, 2, now);
  for (const d of recent) lines.push(`- 決まったこと：${d.text}`);

  const spent = Number(settings.costMonthUsd) || 0;
  const cap = Number(settings.monthlyCapUsd) || 0;
  if (cap > 0) lines.push(`- 今月のAI費用：$${spent.toFixed(2)} ／ 上限 $${cap}`);

  if (!lines.length) return '';
  const body = lines.join('\n');
  return ['## 会社の現在地', body.length > BRIEF_LIMIT ? `${body.slice(0, BRIEF_LIMIT)}…` : body].join('\n');
}

/** 画面に出す短い版（社員に渡すものと同じ材料から作る）。 */
export function briefLines(input) {
  const text = companyBrief(input);
  if (!text) return [];
  return text.split('\n').slice(1).map((l) => l.replace(/^- /, ''));
}
