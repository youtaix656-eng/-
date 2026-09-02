import { useEffect } from 'react';
import { flashTo } from '../lib/focus.js';

/**
 * anchorId が入ってきたら、描き直しのあとに飛び先まで運んで光らせる。
 * タブ切り替え等、状態を変えてから飛ぶ画面があるので1フレーム待つ。
 *
 * 注意：呼び出し元は飛んだあとに anchorId を空へ戻す設計にすること。ただし
 * 「anchorId が空になったら画面の先頭へ戻す」という別の副作用は絶対に作らない
 * （飛んだ直後に先頭へ引き戻されてしまう）。
 */
export function useFocusJump(anchorId, onDone) {
  useEffect(() => {
    if (!anchorId) return undefined;
    const id = requestAnimationFrame(() => {
      flashTo(anchorId);
      onDone?.();
    });
    return () => cancelAnimationFrame(id);
  }, [anchorId, onDone]);
}
