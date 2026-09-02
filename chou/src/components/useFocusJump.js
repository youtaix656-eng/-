import { useEffect } from 'react';
import { flashTo } from '../lib/focus.js';

/**
 * 目次から運ばれてきた飛び先へ移動して光らせるフック。
 * **どの画面からも同じものを使う**（画面ごとに書くと、片方だけ直したときに必ず食い違う）。
 *
 * タブ・絞り込みの切り替えは**この前に `useLayoutEffect` で済ませておく**こと
 * （描き終わる前に切り替えないと、飛び先がまだ画面に無くて掴めない）。
 */
export function useFocusJump(focus, onDone) {
  useEffect(() => {
    if (!focus) return undefined;
    const ok = flashTo(focus);
    // 掴めなくても focus は片付ける（残すと次の移動で古い飛び先へ跳ぶ）
    const id = setTimeout(() => onDone && onDone(ok), 0);
    return () => clearTimeout(id);
  }, [focus, onDone]);
}

export default useFocusJump;
