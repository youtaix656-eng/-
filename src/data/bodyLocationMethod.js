// 体の場所法（視覚障害のある受験生向けの記憶術）。
// 「頭→顔→首→肩→胸→お腹→腰→太もも→膝→すね→足」の順に、体の実際の位置へ近い経穴を
// 上から下へ配置して読む。八会穴はちょうど体の各部に1つずつ対応しているため、最初の組として
// 持つ（kc-* はsrc/data/keiketsuCards.jsのid。新しいデータは増やさず既存カードを参照するだけ）。
// 並び順・体の部位名は人が決めるもので自動推定しない（経穴の位置情報から機械的に導出しない）。

export const BODY_LOCATION_SETS = [
  {
    id: 'hakkaiketsu',
    title: '八会穴（体の場所法）',
    desc: '頭から足へ、体の上から下の順に8つの八会穴を並べています。触って位置を確認しながら聞いてください。',
    items: [
      { cardId: 'kc-bl11', bodyPart: '首の後ろ（背中の上）' },
      { cardId: 'kc-bl17', bodyPart: '背中（肩甲骨の下あたり）' },
      { cardId: 'kc-cv17', bodyPart: '胸の真ん中' },
      { cardId: 'kc-lu9', bodyPart: '手首' },
      { cardId: 'kc-lr13', bodyPart: 'わき腹' },
      { cardId: 'kc-cv12', bodyPart: 'みぞおちの下' },
      { cardId: 'kc-gb34', bodyPart: '膝の外側' },
      { cardId: 'kc-gb39', bodyPart: '外くるぶしの上' },
    ],
  },
];
