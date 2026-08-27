// エンジン別の実績。
//
// 「この種類の仕事は、安いモデルで足りていた」を**自分の記録から**見つけるための表。
// 手元にない基準（他社の平均など）は持たない。
//
// 材料は仕事の手順（step.providerId / model / cost / status）だけ。AIを呼ばない。

import { providerById } from './providers/index.js';

/**
 * @param {object[]} tasks
 * @returns {{providerId, providerName, model, calls, failed, usd, chars, avgChars}[]}
 */
export function engineStats(tasks = []) {
  const map = new Map();
  for (const task of tasks) {
    for (const step of (task.steps || []).flat ? (task.steps || []).flat(2) : task.steps || []) {
      if (!step || !step.providerId) continue;
      const key = `${step.providerId}|${step.model || ''}`;
      const cur = map.get(key) || {
        providerId: step.providerId,
        providerName: providerById(step.providerId)?.name || step.providerId,
        model: step.model || '',
        calls: 0,
        failed: 0,
        usd: 0,
        chars: 0,
      };
      cur.calls += 1;
      if (step.status === 'failed' || step.error) cur.failed += 1;
      cur.usd += Number(step.cost) || 0;
      cur.chars += (step.output || '').length;
      map.set(key, cur);
    }
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      avgChars: r.calls ? Math.round(r.chars / r.calls) : 0,
      // 1円あたり何文字書けたか。**多いほど安上がり**というだけの目安で、
      // 中身の良し悪しではない（そこは人が見る）。
      usdPerCall: r.calls ? r.usd / r.calls : 0,
    }))
    .sort((a, b) => b.calls - a.calls);
}

/** いちばん安く済んでいるエンジン（呼び出しが3回以上あるものだけ）。 */
export function cheapestUsed(rows = []) {
  const enough = rows.filter((r) => r.calls >= 3 && r.usd > 0);
  if (!enough.length) return null;
  return enough.reduce((a, b) => (b.usdPerCall < a.usdPerCall ? b : a));
}

/** 失敗が目立つエンジン（3回以上呼んで、3割以上失敗）。 */
export function unreliable(rows = []) {
  return rows.filter((r) => r.calls >= 3 && r.failed / r.calls >= 0.3);
}
