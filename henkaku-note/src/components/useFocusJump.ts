import { useEffect } from 'react';
import { flashTo } from '../lib/focus';

/**
 * anchorId が入ってきたら、描き直しのあとに飛び先まで運ぶ。
 *
 * 注意1：画面（タブ）の切り替えは **useLayoutEffect** で先に済ませておくこと。
 *   useEffect で切り替えると、飛ぶ時（次のフレーム）にはまだ古い画面が描かれていて着かない。
 * 注意2：飛んだあと呼び出し元が anchor を空へ戻すので、**「anchor が空なら画面の先頭へ」
 *   という副作用を作らないこと**（飛んだ直後に先頭へ引き戻される）。
 */
export function useFocusJump(anchorId: string | null, onDone?: () => void) {
  useEffect(() => {
    if (!anchorId) return undefined;
    const id = requestAnimationFrame(() => {
      flashTo(anchorId);
      if (onDone) onDone();
    });
    return () => cancelAnimationFrame(id);
  }, [anchorId, onDone]);
}
