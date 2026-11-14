import { useEffect, useState } from 'react';

// keiketsuCards.js（経穴カード361件、JSON換算で数十KB）を動的importでキャッシュする入口。
// AudioMode.jsxは下部ナビの即時import画面のため、トップレベルでkeiketsuCards.jsを
// importすると起動時バンドルに丸ごと含まれてしまう（実際にこれで一度ビルドサイズが
// 大きく膨らんだ。mindmapDataLoader.jsと同じ理由・同じ対処）。「体の場所法」を実際に
// 選んだ瞬間まで読み込みを遅らせる。
let promise = null;
export function loadKeiketsuCards() {
  if (!promise) promise = import('../data/keiketsuCards.js');
  return promise;
}

// 共有フック：trigger（真偽値）がtrueになった時だけ読み込みを開始し、完了するまではnullを返す。
export function useKeiketsuCards(trigger) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (data || !trigger) return;
    let cancelled = false;
    loadKeiketsuCards().then((m) => {
      if (!cancelled) setData(m.KEIKETSU_CARDS);
    });
    return () => { cancelled = true; };
  }, [trigger, data]);
  return data;
}
