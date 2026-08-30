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
 * ウロボロス（自分の尾を噛む蛇）。
 * 鱗は細い線を放射状に並べて彫りに見せる。頭のところだけ線を抜いて口をつくる。
 */
export function Ouroboros({ size = 168, stroke = 1, className = '' }) {
  const cx = 100;
  const cy = 100;
  const rIn = 62;
  const rOut = 80;
  // 頭のために線を抜く角度（度。0が右、90が下）。上のあたりを空ける。
  const gapFrom = 250;
  const gapTo = 300;
  const scales = [];
  for (let deg = gapTo + 2; deg < gapFrom + 360; deg += 3.6) {
    const a = (deg * TAU) / 360;
    const [x1, y1] = ring(cx, cy, rIn, a);
    const [x2, y2] = ring(cx, cy, rOut, a);
    scales.push(<line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />);
  }
  const arc = (r, from, to) => {
    const [x1, y1] = ring(cx, cy, r, (from * TAU) / 360);
    const [x2, y2] = ring(cx, cy, r, (to * TAU) / 360);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

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
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* 胴（外側・内側・真ん中の線） */}
      <g opacity="0.9">
        <path d={arc(rOut, gapTo, gapFrom + 360)} />
        <path d={arc(rIn, gapTo, gapFrom + 360)} />
      </g>
      <path d={arc((rIn + rOut) / 2, gapTo, gapFrom + 360)} opacity="0.35" />
      {/* 鱗 */}
      <g opacity="0.5">{scales}</g>

      {/* 尾（口へ向かって細くなる） */}
      <path d="M72.6 24.8 Q 66 26, 62.5 28.5 Q 70 36, 78.8 41.7 Z" opacity="0.9" />

      {/* 頭（右の胴から伸び、開いた口で尾をくわえる） */}
      <g>
        <path d="M139 32 C 135 12, 110 3, 88 9 Q 74 13, 67 19 Q 76 24, 84 26 Q 74 30, 69 34 Q 96 41, 130 47 Z" />
        <circle cx="110" cy="17" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="110" cy="17" r="5.4" opacity="0.6" />
        <path d="M103 10 q 8 -2 14 2" opacity="0.45" />
        <path d="M73 17 l 3 1.4" opacity="0.75" />
        <path d="M90 13 q 16 6 26 16" opacity="0.3" />
        <path d="M92 31 q 14 4 26 9" opacity="0.3" />
      </g>
    </svg>
  );
}

/** 六芒星と目（参考画像の中央の印） */
export function EyeSigil({ size = 84, stroke = 1, className = '' }) {
  const pts = (offset) =>
    [0, 1, 2]
      .map((i) => ring(50, 50, 30, ((offset + i * 120) * TAU) / 360))
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
  const dots = [0, 60, 120, 180, 240, 300].map((deg) => {
    const [x, y] = ring(50, 50, 30, (deg * TAU) / 360);
    return <circle key={deg} cx={x} cy={y} r="1.6" fill="currentColor" stroke="none" />;
  });
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="50" cy="50" r="38" opacity="0.5" />
      <circle cx="50" cy="50" r="30" opacity="0.8" />
      <polygon points={pts(-90)} opacity="0.85" />
      <polygon points={pts(90)} opacity="0.85" />
      {dots}
      {/* 目 */}
      <path d="M33 50 q 17 -13 34 0 q -17 13 -34 0 z" />
      <circle cx="50" cy="50" r="5.5" />
      <circle cx="50" cy="50" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 十字に矢（参考画像の四隅にある小さな印） */
export function CrossMark({ size = 22, className = '' }) {
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
      <path d="M2 12h20M12 2v20" />
      <path d="M2 12l3-2M2 12l3 2M22 12l-3-2M22 12l-3 2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="20" r="2" />
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
