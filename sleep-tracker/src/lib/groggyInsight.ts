// モヤ（眠気）の「きっかけ」タグと睡眠時間の記録から、考えられる原因と対処法を
// ルールベースで導き出す。サーバーやAPIキーを使う生成AIの呼び出しではなく、
// 自分の記録データだけを使ったオフラインの傾向分析（このアプリはサーバー無し・
// ブラウザ完結の方針のため）。

import type { GroggyTrigger, SleepRecord } from '../types/sleep';
import { GROGGY_TRIGGER_LABELS } from '../types/sleep';

export interface GroggyInsight {
  id: string;
  headline: string;
  cause: string;
  countermeasure: string;
  sampleSize: number;
}

const MIN_SAMPLES = 2;

const TRIGGER_EXPLAIN: Record<GroggyTrigger, { cause: string; countermeasure: string }> = {
  caffeine: {
    cause:
      'カフェインの覚醒作用が切れた反動（カフェインクラッシュ）や、糖分による血糖値の急な変動が起きている可能性があります。',
    countermeasure: '摂取量を減らす、必要な時間の90分以上前に飲み終える、糖分の少ないものに変えるなどを試してみてください。',
  },
  heavy_meal: {
    cause: '糖質の多い食事のあとは血糖値が急上昇し、その反動で眠気が出やすくなります（食後高血糖の反動）。',
    countermeasure: '量を控えめにする、野菜やたんぱく質を先に食べる、食後に軽く体を動かすと軽減しやすいです。',
  },
  hunger: {
    cause: '空腹による血糖値の低下が、集中力低下や眠気につながっている可能性があります。',
    countermeasure: 'ナッツやヨーグルトなど血糖値が急上昇しにくい軽い間食を挟んでみてください。',
  },
  screen: {
    cause: '画面を見続けることによる目の疲れや、光による覚醒リズムの乱れが影響している可能性があります。',
    countermeasure: '20分に1回は画面から目を離す、休憩中は遠くを見る、輝度を下げるなどを試してみてください。',
  },
  no_exercise: {
    cause: '体を動かさない時間が続くと血流が滞り、眠気を感じやすくなります。',
    countermeasure: '1〜2時間に1回、立ち上がって歩く・軽くストレッチするだけでも効果があります。',
  },
  sleep_debt: {
    cause: '睡眠負債（合計睡眠時間の不足）が蓄積している可能性があります。',
    countermeasure: '直近数日の合計睡眠時間も見直し、可能ならコア睡眠か仮眠を30分延ばしてみてください。',
  },
  weather: {
    cause: '気温や湿度の変化が自律神経に影響し、眠気につながることがあります。',
    countermeasure: '室温・湿度を快適な範囲に保つ、こまめに換気するなどを試してみてください。',
  },
  condition: {
    cause: '体調の波（生理周期を含む）はホルモンバランスの変化から眠気に直結しやすいタイミングです。',
    countermeasure: 'この時期は無理をせず、あらかじめ仮眠を計画に組み込んでおくと乗り切りやすくなります。',
  },
  other: {
    cause: '「その他」でまとめられているため、具体的な傾向はまだ見えていません。',
    countermeasure: '次にモヤを感じたときは、できるだけ具体的なきっかけタグを選んで記録してみてください。',
  },
};

// きっかけタグごとの発生頻度から傾向を出す。
export function analyzeGroggyTriggers(records: SleepRecord[]): GroggyInsight[] {
  const counts = new Map<GroggyTrigger, { count: number; sumIntensity: number }>();
  for (const r of records) {
    for (const g of r.grogginessPeriods) {
      for (const t of g.triggers ?? []) {
        const cur = counts.get(t) ?? { count: 0, sumIntensity: 0 };
        cur.count += 1;
        cur.sumIntensity += g.intensity;
        counts.set(t, cur);
      }
    }
  }

  const insights: GroggyInsight[] = [];
  for (const [trigger, v] of counts.entries()) {
    if (v.count < MIN_SAMPLES) continue;
    const avg = v.sumIntensity / v.count;
    const explain = TRIGGER_EXPLAIN[trigger];
    insights.push({
      id: `trigger:${trigger}`,
      headline: `${GROGGY_TRIGGER_LABELS[trigger]}のあとにモヤが多い（${v.count}件・平均強度${avg.toFixed(1)}）`,
      cause: explain.cause,
      countermeasure: explain.countermeasure,
      sampleSize: v.count,
    });
  }
  return insights.sort((a, b) => b.sampleSize - a.sampleSize);
}

// 合計睡眠時間が短い日ほどモヤが強いかどうかを比較する。
export function analyzeSleepDebtGroggy(records: SleepRecord[]): GroggyInsight | null {
  const withData = records.filter((r) => r.totalSleepHours > 0);
  if (withData.length < 4) return null;

  const sorted = [...withData].sort((a, b) => a.totalSleepHours - b.totalSleepHours);
  const mid = Math.floor(sorted.length / 2);
  const shortGroup = sorted.slice(0, mid);
  const longGroup = sorted.slice(mid);

  const avgGroggyIntensity = (group: SleepRecord[]) => {
    const total = group.reduce((sum, r) => sum + r.grogginessPeriods.reduce((s, g) => s + g.intensity, 0), 0);
    return total / group.length;
  };

  const shortAvg = avgGroggyIntensity(shortGroup);
  const longAvg = avgGroggyIntensity(longGroup);
  if (shortAvg === 0 || shortAvg <= longAvg * 1.2) return null;

  const shortHoursAvg = shortGroup.reduce((sum, r) => sum + r.totalSleepHours, 0) / shortGroup.length;
  const explain = TRIGGER_EXPLAIN.sleep_debt;
  return {
    id: 'sleep_debt_pattern',
    headline: `睡眠時間が短い日（平均${shortHoursAvg.toFixed(1)}h）はモヤが強く出る傾向`,
    cause: explain.cause,
    countermeasure: explain.countermeasure,
    sampleSize: shortGroup.length,
  };
}

export function buildGroggyInsights(records: SleepRecord[]): GroggyInsight[] {
  const debt = analyzeSleepDebtGroggy(records);
  const triggers = analyzeGroggyTriggers(records);
  return debt ? [debt, ...triggers] : triggers;
}
