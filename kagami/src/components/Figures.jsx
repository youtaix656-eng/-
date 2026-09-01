import React from 'react';
import scream from '../assets/figures/scream.webp';
import upside from '../assets/figures/upside.webp';
import crowd from '../assets/figures/crowd.webp';
import skull from '../assets/figures/skull.webp';
import veil from '../assets/figures/veil.webp';
import rabbit from '../assets/figures/rabbit.webp';
import shadow from '../assets/figures/shadow.webp';
import close from '../assets/figures/close.webp';
import eyes from '../assets/figures/eyes.webp';
import hand from '../assets/figures/hand.webp';
import peek from '../assets/figures/peek.webp';
import water from '../assets/figures/water.webp';

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
  { id: 'scream', name: '叫ぶ頭', reading: 'さけぶあたま', src: scream },
  { id: 'upside', name: '逆さの顔', reading: 'さかさのかお', src: upside },
  { id: 'crowd', name: '群れ', reading: 'むれ', src: crowd },
  { id: 'skull', name: '骨の顔', reading: 'ほねのかお', src: skull },
  { id: 'veil', name: '長い髪の面', reading: 'ながいかみのおもて', src: veil },
  { id: 'rabbit', name: '兎の面', reading: 'うさぎのおもて', src: rabbit },
  { id: 'shadow', name: '影の人', reading: 'かげのひと', src: shadow },
  { id: 'close', name: '近すぎる顔', reading: 'ちかすぎるかお', src: close },
  { id: 'eyes', name: '闇の中の目', reading: 'やみのなかのめ', src: eyes },
  { id: 'hand', name: '伸びてくる手', reading: 'のびてくるて', src: hand },
  { id: 'peek', name: '覗いている顔', reading: 'のぞいているかお', src: peek },
  { id: 'water', name: '水面の目', reading: 'すいめんのめ', src: water },
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
