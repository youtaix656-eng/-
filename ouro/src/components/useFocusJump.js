// 目次から別の画面へ飛ぶときの受け口。
//
// 画面が lazy に読まれるので、`go()` した直後にはまだ飛び先が描かれていない。
// **描かれるまで数フレーム待ってから** `flashTo` を呼ぶ（見つかったらやめる）。
//
// **飛ぶ前の状態の切り替え（枠を変える・カードを開く）は `useLayoutEffect` で行うこと**
// ——`useEffect` にすると、描き直しが `flashTo`（次のフレーム）より後になり、
// React が要素を作り直した拍子に印が消える。

import { useCallback, useEffect, useRef } from 'react';
import { flashTo } from '../lib/focus.js';

/** 何フレームまで待つか（lazy な画面の読み込みぶん）。 */
export const MAX_TRIES = 40;

export function useFocusJump(anchor, { onDone = null } = {}) {
  const doneRef = useRef(null);

  useEffect(() => {
    if (!anchor || doneRef.current === anchor) return undefined;
    let tries = 0;
    let raf = 0;
    const tick = () => {
      if (flashTo(anchor)) {
        doneRef.current = anchor;
        if (onDone) onDone(anchor);
        return;
      }
      tries += 1;
      if (tries < MAX_TRIES) raf = requestAnimationFrame(tick);
      // **見つからなくても黙って諦めるだけ**——ここで画面を動かすと、
      // 飛び先の無い項目を押した時に勝手にスクロールしてしまう。
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anchor, onDone]);

  /** その場（同じ画面の中）で飛ぶとき用。 */
  return useCallback((id) => flashTo(id), []);
}

export default useFocusJump;
