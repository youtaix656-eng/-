import { useEffect } from 'react';
import { flashTo } from '../lib/focus.js';

/**
 * anchorId が入ってきたら、描き直しのあとに飛び先まで運ぶ。
 * 状態（開く・絞り込む）を変えてから飛ぶ画面があるので、1フレーム待つ。
 *
 * 注意：飛んだあとに呼び出し元が focus を空へ戻すので、**「focus が空なら画面の先頭へ」
 * という副作用を作らないこと**（飛んだ直後に先頭へ引き戻される。実際に踏んだ）。
 */
export function useFocusJump(anchorId, onDone) {
  useEffect(() => {
    if (!anchorId) return undefined;
    const id = requestAnimationFrame(() => {
      flashTo(anchorId);
      if (onDone) onDone();
    });
    return () => cancelAnimationFrame(id);
  }, [anchorId, onDone]);
}
