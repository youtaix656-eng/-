// 誤答理由（型）の記録・傾向表示・次回間隔調整をまとめたフック。
//   以前はReview.jsx（setNextDueで間隔調整あり）とSession.jsx（間隔調整なし）で
//   同じ「誤答理由を記録する」機能の挙動が食い違っていた（単一の正で統一）。
//   setNextDueを渡さない呼び出し元は記録のみ（間隔調整なし）のまま使える。

import { useEffect, useMemo, useState } from 'react';
import { loadMissTypes, recordMissType, missTypeTrend, missTypeAnomaly, MISS_TYPE_DELAY_MS } from './missTypes.js';

export function useMissTypeHandling(setNextDue) {
  const [missTypes, setMissTypes] = useState({});
  useEffect(() => { loadMissTypes().then(setMissTypes); }, []);
  const missTrend = useMemo(() => missTypeTrend(missTypes), [missTypes]);
  const missAnomaly = useMemo(() => missTypeAnomaly(missTypes), [missTypes]);
  const onMissType = (id, type) => {
    recordMissType(id, type).then(setMissTypes);
    // 型別に次回の再出題間隔を調整（ケアレスは短め、知識不足は長め）。
    if (setNextDue) setNextDue(id, MISS_TYPE_DELAY_MS[type] || 20 * 60 * 1000);
  };
  return { missTypes, missTrend, missAnomaly, onMissType };
}
