import React from 'react';

// 版画（銅版画）ふうの飾り — **その場で線を引く SVG で描き、画像ファイルを持たない**。
// 色は必ず currentColor（＝周りの文字の色）を使う。ここに色を書かない。
//
// 飾りは飾りに徹すること：**文字の下に濃く敷かない**。
// 読みにくくなった時点で、雰囲気のために中身を犠牲にしている。

const TAU = Math.PI * 2;

function ring(cx, cy, r, a) {
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

/**
 * 二つの円と、その間（このアプリの印）。
 * 二人ぶんの輪を、重なりを残したまま並べる。**重なりは塗らない**——
 * 近いほど良い、という図にしてしまわないため。鱗のような短い線で彫りに見せる。
 */
export function TwoCircles({ size = 176, stroke = 1, className = '' }) {
  const cy = 100;
  const r = 54;
  const lefts = [];
  const rights = [];
  // 円の外側だけに短い線を放射状に並べる（内側に引くと文字の下が濃くなる）
  for (let deg = 0; deg < 360; deg += 4) {
    const a = (deg * TAU) / 360;
    const [x1, y1] = ring(74, cy, r, a);
    const [x2, y2] = ring(74, cy, r + 7, a);
    if (x1 < 74) lefts.push(<line key={`l${deg}`} x1={x1} y1={y1} x2={x2} y2={y2} />);
    const [x3, y3] = ring(126, cy, r, a);
    const [x4, y4] = ring(126, cy, r + 7, a);
    if (x3 > 126) rights.push(<line key={`r${deg}`} x1={x3} y1={y3} x2={x4} y2={y4} />);
  }
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="74" cy={cy} r={r} opacity="0.9" />
      <circle cx="126" cy={cy} r={r} opacity="0.9" />
      <g opacity="0.35">{lefts}</g>
      <g opacity="0.35">{rights}</g>
      {/* それぞれの中心（人の側） */}
      <circle cx="74" cy={cy} r="2.4" fill="currentColor" stroke="none" />
      <circle cx="126" cy={cy} r="2.4" fill="currentColor" stroke="none" />
      {/* 間（あいだ）。線ではなく、目盛りで示す */}
      <path d="M100 62 v 76" opacity="0.28" strokeDasharray="3 5" />
      <path d="M92 100 h 16" opacity="0.6" />
      <path d="M92 96 v 8 M108 96 v 8" opacity="0.6" />
      {/* 外の枠 */}
      <circle cx="100" cy={cy} r="92" opacity="0.18" />
    </svg>
  );
}

/** 見出しの上に置く小さな印（円と、そこに空いた間） */
export function GapSigil({ size = 64, stroke = 1, className = '' }) {
  const arc = (r, from, to) => {
    const [x1, y1] = ring(50, 50, r, (from * TAU) / 360);
    const [x2, y2] = ring(50, 50, r, (to * TAU) / 360);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  const ticks = [];
  for (let deg = 0; deg < 360; deg += 30) {
    const a = (deg * TAU) / 360;
    const [x1, y1] = ring(50, 50, 34, a);
    const [x2, y2] = ring(50, 50, 38, a);
    ticks.push(<line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />);
  }
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="50" cy="50" r="42" opacity="0.35" />
      <g opacity="0.5">{ticks}</g>
      {/* 左右の弧が、真ん中を空けて向き合う */}
      <path d={arc(26, 100, 260)} opacity="0.9" />
      <path d={arc(26, 280, 440)} opacity="0.9" />
      <circle cx="50" cy="50" r="3" opacity="0.9" />
      <path d="M50 20 v 8 M50 72 v 8" opacity="0.5" />
    </svg>
  );
}

/** 四隅に置く小さな印（方位のしるし） */
export function CornerMark({ size = 22, className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2 l4 10 l-4 10 l-4 -10 z" />
      <path d="M2 12 h20" opacity="0.5" />
      <circle cx="12" cy="12" r="1.6" />
    </svg>
  );
}

/** 見出しの下に引く細い罫（真ん中に印をひとつ） */
export function Rule({ mark = '✦', className = '' }) {
  return (
    <div className={`rule ${className}`} aria-hidden="true">
      <span className="rule-line" />
      <span className="rule-mark">{mark}</span>
      <span className="rule-line" />
    </div>
  );
}
