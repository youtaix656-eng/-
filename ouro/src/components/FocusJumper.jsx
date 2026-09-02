// 目次の飛び先へ運んで光らせるだけの、描かない部品。
//
// 画面そのものは lazy に読まれるので、`go()` した直後にはまだ飛び先が無い。
// `useFocusJump` が描かれるまで数フレーム待ち、見つからなければ**何もしない**
// （飛び先の無い項目を押した時に、勝手にスクロールさせないため）。

import { useFocusJump } from './useFocusJump.js';

export default function FocusJumper({ anchor, onDone }) {
  useFocusJump(anchor, { onDone });
  return null;
}
