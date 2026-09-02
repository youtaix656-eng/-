// 「○にした問題をふりかえる」の状態管理を1か所にまとめたフック。
//   以前はSession.jsxだけがこの6行セットをインラインで持っていたため、
//   Quiz.jsxに同じ機能を追加する時に丸ごと複製することになっていた（単一の正）。

import { useMemo, useState } from 'react';
import { maruStatusList, excludeMastered, orderMaruStatus } from './maruPool.js';

export function useMaruReview(pool, history, srs) {
  const [maruExcludeMastered, setMaruExcludeMastered] = useState(false);
  const maruStatusAll = useMemo(() => maruStatusList(pool, history, srs), [pool, history, srs]);
  const maruUncertainCount = useMemo(() => maruStatusAll.filter((s) => s.uncertain).length, [maruStatusAll]);
  const maruStatusFiltered = useMemo(
    () => (maruExcludeMastered ? excludeMastered(maruStatusAll) : maruStatusAll),
    [maruStatusAll, maruExcludeMastered]
  );
  const maruOrdered = useMemo(() => orderMaruStatus(maruStatusFiltered), [maruStatusFiltered]);
  const maruPool = useMemo(() => maruOrdered.map((s) => s.question), [maruOrdered]);

  return {
    maruExcludeMastered,
    setMaruExcludeMastered,
    maruStatusAll,
    maruUncertainCount,
    maruStatusFiltered,
    maruOrdered,
    maruPool,
  };
}
