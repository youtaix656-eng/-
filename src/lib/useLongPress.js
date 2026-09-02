import { useRef } from 'react';

// 長押しで別の動作をする共通フック。誤タップで失いたくない操作向け（Home.jsxの
// 「前回の続きから」カード削除と同じパターンをここに切り出し、他画面からも再利用する）。
// タップ＝onTap、長押し（LONG_PRESS_MS）＝onLongPress。
const LONG_PRESS_MS = 550;

export function useLongPress(onLongPress, onTap) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  const start = () => {
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };
  const clear = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };
  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => e.preventDefault(),
    onClick: () => {
      if (firedRef.current) { firedRef.current = false; return; }
      onTap();
    },
  };
}
