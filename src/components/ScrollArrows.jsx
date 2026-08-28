// 画面の右端に置く、スクロール用の矢印。
//
// 目次・一問一答の解説・ロードマップなど、縦に長い画面を
// 指で何度もはらわずに動かせるようにする。
//
// 決まりごと（Ouro側と同じ考え方で揃えてある）：
//  ・**動かない画面には出さない。** 中身が1画面に収まっている時は、押しても
//    何も起きないボタンになるので丸ごと隠す。
//  ・端まで来た側の矢印は**消さずに薄くする**（位置が動くと押し損ねるため）。
//  ・重なりはロードマップバー（28）より下に置く。ミニプレーヤー・下部ナビ・
//    モーダルが開いたら隠れてよい。
//  ・**画面の分岐（renderView）の中に入れない**——入れるとその画面にしか出ない。

import { useCallback, useEffect, useRef, useState } from 'react';

/** 端とみなす余白。ぴったり0でしか消えないと、端で薄くならない。 */
const EDGE = 24;
/** 1回で動かす量（画面の高さのうち）。全部だと前後が見えなくなる。 */
const STEP = 0.85;

export default function ScrollArrows({ view }) {
  const [st, setSt] = useState({ show: false, atTop: true, atBottom: false });
  const rafRef = useRef(0);

  const measure = useCallback(() => {
    const el = document.documentElement;
    const y = window.scrollY || el.scrollTop || 0;
    const max = Math.max(0, el.scrollHeight - window.innerHeight);
    setSt({ show: max > EDGE, atTop: y <= EDGE, atBottom: y >= max - EDGE });
  }, []);

  useEffect(() => {
    const onChange = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        measure();
      });
    };
    measure();
    window.addEventListener('scroll', onChange, { passive: true });
    window.addEventListener('resize', onChange);
    // 画面を切り替えると中身の高さが変わる。lazy な画面は少し遅れて入るので、
    // **高さの変化そのもの**を見る（view の変化だけ見ていると、読み込み前の
    // 短い状態で測ってしまい、矢印が出ない）。
    let ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(onChange);
      ro.observe(document.body);
    }
    return () => {
      window.removeEventListener('scroll', onChange);
      window.removeEventListener('resize', onChange);
      if (ro) ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [measure]);

  // ResizeObserver が無い端末のための保険（画面を切り替えたら測り直す）
  useEffect(() => {
    measure();
  }, [view, measure]);

  if (!st.show) return null;

  const move = (dir) => {
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({
      top: dir * Math.round(window.innerHeight * STEP),
      behavior: reduce ? 'auto' : 'smooth',
    });
  };

  return (
    <div className="scroll-arrows">
      <button type="button" aria-label="1画面ぶん上へ" disabled={st.atTop} onClick={() => move(-1)}>
        ▲
      </button>
      <button type="button" aria-label="1画面ぶん下へ" disabled={st.atBottom} onClick={() => move(1)}>
        ▼
      </button>
    </div>
  );
}
