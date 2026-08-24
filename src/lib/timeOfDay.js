// 学習履歴の時間帯別パフォーマンス分析（⑦）— 朝/昼/夕方・夜/深夜のどの時間帯に
// 正答率が高いかを集計する。自分に合った学習時間帯が見えるようにする。

export const TIME_BUCKETS = [
  { id: 'morning', label: '朝（5-11時）', from: 5, to: 11 },
  { id: 'midday', label: '昼（11-17時）', from: 11, to: 17 },
  { id: 'evening', label: '夕方・夜（17-23時）', from: 17, to: 23 },
  { id: 'night', label: '深夜（23-5時）', from: 23, to: 5 }, // 日をまたぐ
];

function bucketOf(hour) {
  for (const b of TIME_BUCKETS) {
    if (b.from < b.to) {
      if (hour >= b.from && hour < b.to) return b.id;
    } else if (hour >= b.from || hour < b.to) {
      return b.id; // 深夜（23時〜翌5時）のように日をまたぐ帯
    }
  }
  return null;
}

// history: [{ at, correct, ... }] → 時間帯ごとの集計。
// minSample未満の時間帯は比較対象として不十分なので best からは除外する。
export function hourlyPerformance(history = [], { minSample = 10 } = {}) {
  const counts = Object.fromEntries(TIME_BUCKETS.map((b) => [b.id, { total: 0, correct: 0 }]));
  for (const h of history) {
    if (!h.at) continue;
    const hour = new Date(h.at).getHours();
    const id = bucketOf(hour);
    if (!id) continue;
    counts[id].total += 1;
    if (h.correct) counts[id].correct += 1;
  }
  const buckets = TIME_BUCKETS.map((b) => {
    const c = counts[b.id];
    return {
      id: b.id,
      label: b.label,
      total: c.total,
      correct: c.correct,
      accuracy: c.total > 0 ? c.correct / c.total : null,
    };
  });
  const qualified = buckets.filter((b) => b.total >= minSample && b.accuracy != null);
  const best = qualified.length > 0 ? qualified.reduce((a, b) => (b.accuracy > a.accuracy ? b : a)) : null;
  return { buckets, best };
}
