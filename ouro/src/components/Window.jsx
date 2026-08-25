// 長い一覧の「見えている範囲だけ描く」小さな仕組み（新項目14）。
//
// content-visibility は**描画**を省くが、要素そのものは作られる。
// 数千件になると、要素を作るところで固まる。そこで、スクロール位置から
// 「いま見えている範囲」を割り出し、その前後だけを描く。
//
// **外部のライブラリは入れない方針**（Ouro は外部ランタイム依存なし）なので、
// 必要最小限だけを自前で持つ。前提は1つ——**行の高さがそろっていること**。
// 高さがまちまちな一覧には使わない（ずれてスクロールが飛ぶ）。

import { useEffect, useRef, useState } from 'react';

/**
 * @param {Array} items    並んでいるもの
 * @param {number} rowHeight 1行の高さ（px・おおよそで良いが、そろっていること）
 * @param {number} overscan 画面の外にも描いておく行数（速いスクロールで白くしない）
 * @param {(item, index) => JSX} children 1行の描き方
 */
export default function Window({ items, rowHeight, overscan = 6, children }) {
  const boxRef = useRef(null);
  const [range, setRange] = useState({ start: 0, end: 40 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      // 枠の上端が画面のどれだけ上にあるか＝何行ぶん流れたか
      const above = Math.max(0, -rect.top);
      const start = Math.max(0, Math.floor(above / rowHeight) - overscan);
      const visible = Math.ceil(window.innerHeight / rowHeight) + overscan * 2;
      setRange((cur) => {
        const end = Math.min(items.length, start + visible);
        if (cur.start === start && cur.end === end) return cur; // 変わっていないなら描き直さない
        return { start, end };
      });
    };

    const onScroll = () => {
      // スクロールのたびに計算すると重い。次の描画に1回だけまとめる。
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items.length, rowHeight, overscan]);

  const start = Math.min(range.start, Math.max(0, items.length - 1));
  const end = Math.min(range.end, items.length);
  const slice = items.slice(start, end);

  return (
    <div ref={boxRef}>
      {/* 上下の余白で、描いていない行のぶんの高さを確保する。
          **ここで高さを二重に確保しないこと**（枠にも高さを持たせると倍になる）。 */}
      <div style={{ height: start * rowHeight }} />
      {slice.map((item, i) => children(item, start + i))}
      <div style={{ height: Math.max(0, (items.length - end) * rowHeight) }} />
    </div>
  );
}
