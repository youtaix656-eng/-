// 収益導線の「書き込み」側（新規）。
//
// **lib/funnel.js と分けてある。** ホームは「いまどこが詰まっているか」を
// 1行出すだけなので、週の数字を書く処理まで起動時に読ませない。
// ここを使うのは導線の画面だけ。

import { newId } from './id.js';
import { FUNNEL_STAGES, stageById, normalizeFunnel, labelOf, stageStats, weekChange, latestEntry, pct, startOfWeek } from './funnel.js';

export const MAX_ENTRIES = 104; // 2年ぶん

/** 週の数字を1件足す（同じ週があれば置き換える）。 */
export function putEntry(funnel, { weekStart, values = {}, note = '' }) {
  const f = normalizeFunnel(funnel);
  const at = startOfWeek(weekStart || Date.now());
  const clean = {};
  for (const s of FUNNEL_STAGES) {
    const n = Number(values[s.id]);
    clean[s.id] = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  }
  const entry = { id: newId('wk'), weekStart: at, values: clean, note: String(note || '').slice(0, 200) };
  const rest = f.entries.filter((e) => e.weekStart !== at);
  const entries = [...rest, entry].sort((a, b) => a.weekStart - b.weekStart).slice(-MAX_ENTRIES);
  return { ...f, entries, updatedAt: Date.now() };
}

export function removeEntry(funnel, id) {
  const f = normalizeFunnel(funnel);
  return { ...f, entries: f.entries.filter((e) => e.id !== id), updatedAt: Date.now() };
}

/**
 * 分析担当への依頼文を作る。**数字はここで文章にして渡す**
 * （依頼画面に手で貼り直さなくて済むように）。
 */
export function analysisRequest(funnel) {
  const f = normalizeFunnel(funnel);
  const entry = latestEntry(f);
  if (!entry) return '';
  const change = weekChange(f);
  const lines = [
    '今週の数字を見て、次に何を直すか決めたいです。',
    '',
    '## 今週の数字',
    ...stageStats(entry).map((x) => {
      const s = stageById(x.stageId);
      return `- ${labelOf(f, x.stageId)}（${s.metric}）：${x.value}人${x.rate === null ? '' : `（前の段からの通過率 ${pct(x.rate)}）`}`;
    }),
  ];
  if (change) {
    lines.push('', '## 前の週との差');
    for (const r of change.rows) {
      lines.push(`- ${labelOf(f, r.stageId)}：${r.before} → ${r.now}（${r.diff >= 0 ? '+' : ''}${r.diff}）`);
    }
  }
  if (entry.note) lines.push('', `## 今週やったこと`, entry.note);
  lines.push(
    '',
    '## お願い',
    '「結果 → 変化 → 仮説 → 次の改善」の順で整理してください。',
    '**次に試すことは最大3つまで**にしてください（同時に多く変えると、何が効いたか分からなくなります）。',
    'それぞれに「どの数字がどうなったら成功か」を必ず書いてください。',
    '手元にない数字を推測で埋めないでください。足りない数字は「これを測ってください」と書いてください。'
  );
  return lines.join('\n');
}
