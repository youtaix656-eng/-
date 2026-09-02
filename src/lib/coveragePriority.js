// 網羅マップの「次に何を埋めるか」を決めるための優先度付け・書き出し・リマインド
// （#9・#10・#16・#17）。coverageBySubject()の戻り値（rows）を主な入力にする。

import { daikoumokuRank } from './pastExamTrends.js';

// 手薄な大項目のうち、過去問での頻出度（A/B/Cランク、pastExamTrends.js）が高いものを
// 最優先にした「埋めるべき順」のToDoを作る（#16。手元に無い配点等は使わない）。
export function priorityTodo(rows, questions, { limit = 10 } = {}) {
  const rank = daikoumokuRank(questions);
  const RANK_WEIGHT = { A: 3, B: 2, C: 1 };
  const items = [];
  for (const r of rows || []) {
    if (r.total === 0) {
      items.push({ subject: r.name, daikoumoku: null, count: 0, rank: null, score: 5, reason: '未収録' });
      continue;
    }
    for (const g of r.groups) {
      if (g.count >= r.thinThreshold) continue; // すでに手薄でない大項目は対象外
      const rk = rank.get(`${r.name}|${g.name}`);
      const score = (RANK_WEIGHT[rk] || 0) + Math.max(0, (r.thinThreshold - g.count) / r.thinThreshold);
      items.push({
        subject: r.name,
        daikoumoku: g.name,
        count: g.count,
        rank: rk || null,
        score,
        reason: rk ? `頻出${rk}ランクなのに${g.count}問` : `${g.count}問と手薄`,
      });
    }
  }
  return items.sort((a, b) => b.score - a.score).slice(0, limit);
}

// 手薄科目のジャンル別内訳をテキストで書き出す（#9）。
export function thinSubjectsText(rows) {
  const thin = (rows || []).filter((r) => r.total === 0 || r.total < r.thinThreshold);
  const lines = ['■ 手薄科目の内訳（網羅マップより）', ''];
  for (const r of thin) {
    lines.push(`【${r.name}】 総数${r.total}問（しきい値${r.thinThreshold}問）`);
    for (const g of r.groups) lines.push(`  - ${g.name}：${g.count}問`);
    if (r.groups.length === 0) lines.push('  （未収録）');
    lines.push('');
  }
  return lines.join('\n');
}

// 過去問PDFを貼ってもらう時の定型メッセージ（#10）。
export function requestTemplate(subjectName) {
  return `${subjectName}の過去問PDFを貼ります。標準変換プロンプトの手順で教材化してください。`;
}

// 日替わりで安定した1件を選ぶ（featureDiscovery.jsと同じ方式）。
function dayIndex(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const diff = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start;
  return Math.floor(diff / 86400000);
}

// 手薄科目のうち、日替わりで1件だけリマインドする（#17）。無ければnull。
export function suggestThinSubjectReminder(rows, date = new Date()) {
  const candidates = (rows || []).filter((r) => r.total === 0 || r.total < r.thinThreshold);
  if (candidates.length === 0) return null;
  const idx = dayIndex(date) % candidates.length;
  return candidates[idx];
}
