// 印（しるし）— 画面に出る記号は、ここが単一の正。
//
// 守ること:
//   1. **絵文字を使わない。** 絵文字は環境によって色付きで描かれるので、
//      モノクロの画面に色が混ざる（しかも端末ごとに違う形になる）。
//      ここに置くのは**文字として描かれる記号だけ**で、色は必ず周りの文字から受け継ぐ。
//   2. 新しい記号を足すときは、**まずここに足す**。
//      test/mono.test.mjs が「画面に出る印はすべてこの一覧の中のもの」を機械チェックする。
//   3. 意味が近いもの同士は形を離す（○ と ⊙ と ◎ を隣り合う画面で使い分けない）。

export const GLYPHS = {
  sun: '☉',
  moonWax: '☽',
  moonWane: '☾',
  star: '✦',
  starOutline: '✧',
  circle: '○',
  circleDouble: '◎',
  circleDot: '⊙',
  circlePlus: '⊕',
  circleCross: '⊗',
  square: '□',
  squareFilled: '■',
  squareSmall: '▫',
  diamond: '◆',
  diamondOutline: '◇',
  diamondInset: '◈',
  triangle: '△',
  triangleDown: '▽',
  pointer: '▷',
  cross: '✕',
  dagger: '†',
  doubleDagger: '‡',
  reference: '※',
  infinity: '∞',
  lines: '≡',
  house: '⌂',
  piece: '☖',
};

/**
 * 順番を出す印。**番号そのものに意味がある所だけ**に使う
 * （おすすめの手を①②③と並べる、など）。飾りには使わない。
 */
export const ORDER_MARKS = ['①', '②', '③', '④', '⑤'];

/** 画面に出してよい印（テストが使う） */
export const ALLOWED_GLYPHS = new Set([...Object.values(GLYPHS), ...ORDER_MARKS]);
