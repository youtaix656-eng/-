import React, { useEffect, useRef, useState } from 'react';

// 右端のスクロール矢印（提案24）。読み物が長くなったので足したもの。
//
// 決めていること（Ouro・鍼灸アプリと同じ形）
//  - **動かない画面では丸ごと出さない**（押しても何も起きないボタンを出さない）。
//  - **端まで来た側は消さずに薄くする**（消すと位置が動いて押し損ねる）。
//  - **中身の高さは ResizeObserver で見る**——画面が入れ替わった直後は、
//    まだ短い状態で測ってしまって矢印が出ない。
//  - 下部ナビ・常設バーより下に置く（重なったら隠れる側）。

export default function ScrollArrows() {
  const [show, setShow] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    const measure = () => {
      const doc = document.documentElement;
      const room = doc.scrollHeight - window.innerHeight;
      setShow(room > 120);
      setAtTop(window.scrollY <= 8);
      setAtBottom(window.scrollY >= room - 8);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onScroll);
      ro.observe(document.body);
    }
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (ro) ro.disconnect();
    };
  }, []);

  // **絵文字を使わない**（決まり9）。印はその場に線を引く
  const Chevron = ({ up }) => (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d={up ? 'M5 15 L12 8 L19 15' : 'M5 9 L12 16 L19 9'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (!show) return null;
  const step = Math.round(window.innerHeight * 0.8);
  const go = (n) => window.scrollBy({ top: n, behavior: 'smooth' });

  return (
    <div className="scroll-arrows" aria-hidden="false">
      <button
        type="button"
        className={`scroll-arrow${atTop ? ' dim' : ''}`}
        aria-label="上へ"
        onClick={() => go(-step)}
      >
        <Chevron up />
      </button>
      <button
        type="button"
        className={`scroll-arrow${atBottom ? ' dim' : ''}`}
        aria-label="下へ"
        onClick={() => go(step)}
      >
        <Chevron up={false} />
      </button>
    </div>
  );
}
