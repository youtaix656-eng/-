import React from 'react';
import veil from '../assets/figures/veil.webp';
import grin from '../assets/figures/grin.webp';
import water from '../assets/figures/water.webp';
import noh from '../assets/figures/noh.webp';
import hood from '../assets/figures/hood.webp';
import pair from '../assets/figures/pair.webp';

// 地に敷く面（おもて）。
//
// **絵は手で描いた画像ではなく、`tools/draw-figures.js` がキャンバスに描いて焼いたもの。**
// 直すときは画像を塗り直さず、`node tools/make-figures.mjs` で焼き直す
// （画像を直接いじると、次に焼いた時に消える）。
//
// 使う色は灰色だけ（生成側で rgb(v,v,v) しか使っていない）。
// **飾りは飾りに徹すること**——濃さと下へのぼかしは CSS（.figure-bg）で決める。
// 読みにくくなった時点で、雰囲気のために中身を犠牲にしている。

/**
 * 地に敷ける面の一覧。**読みは必須**（目次・並びの共通ルールと同じ）。
 * 1件足せば、開くたびに出る候補が自動で増える。
 */
export const FIGURES = [
  { id: 'veil', name: '長い髪の面', reading: 'ながいかみのおもて', src: veil },
  { id: 'grin', name: '笑う面', reading: 'わらうおもて', src: grin },
  { id: 'water', name: '水面の目', reading: 'みなものめ', src: water },
  { id: 'noh', name: '能の面', reading: 'のうのおもて', src: noh },
  { id: 'hood', name: 'フードの影', reading: 'ふーどのかげ', src: hood },
  { id: 'pair', name: '二つの影', reading: 'ふたつのかげ', src: pair },
];

export const FIGURE_MAP = Object.fromEntries(FIGURES.map((f) => [f.id, f]));

/** 地に敷く1枚。**読み上げからは外す**（絵に意味を持たせない） */
export default function FigureBackground({ id }) {
  const found = FIGURE_MAP[id] || FIGURES[0];
  return (
    <div className="figure-bg" aria-hidden="true">
      <img src={found.src} alt="" decoding="async" />
    </div>
  );
}
