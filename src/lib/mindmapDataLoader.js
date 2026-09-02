import { useEffect, useState } from 'react';

// mindmapData.js（COMPARISONS/NUMBER_FACTS、合計約14万字）を動的importでキャッシュする
//   単一の入口。QuestionCard.jsx・AudioMode.jsx・Quiz.jsx・Review.jsx・Session.jsxは
//   いずれも下部ナビの即時import画面（またはそこから使われる共通部品）のため、
//   トップレベルでmindmapData.jsをimportすると起動時バンドルに丸ごと含まれてしまう
//   （実測：COMPARISONSとNUMBER_FACTSだけでJSON換算約14万バイト）。実際に
//   「まぎらわしい対比」「連結学習の比較/数値モード」を使う瞬間まで読み込みを遅らせる。
//   **mindmapData.jsを直接importする画面を新しく増やす時は、このローダー経由にすること**
//   （直接importが1箇所でも残っていると、動的importが効かず丸ごとeagerバンドルへ戻ってしまう。
//   Viteのビルド時に「dynamic import will not move module into another chunk」と警告が出る）。
let promise = null;
export function loadMindmapData() {
  if (!promise) promise = import('../data/mindmapData.js');
  return promise;
}

// 共有フック：trigger（真偽値）がtrueになった時だけ読み込みを開始し、完了するまではnullを返す。
// 呼び出し側はnullの間、空配列などへフォールバックする。
export function useMindmapData(trigger) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (data || !trigger) return;
    let cancelled = false;
    loadMindmapData().then((m) => {
      if (cancelled) return;
      setData({
        COMPARISONS: m.COMPARISONS,
        NUMBER_FACTS: m.NUMBER_FACTS,
        comparisonsForKeyword: m.comparisonsForKeyword,
        numbersForKeyword: m.numbersForKeyword,
      });
    });
    return () => { cancelled = true; };
  }, [trigger, data]);
  return data;
}
