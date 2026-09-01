import React from 'react';

// 地に敷く面（おもて）— **その場で線を引く SVG で描き、画像ファイルを持たない**。
// 色は必ず currentColor（＝周りの文字の色）。ここに色を書かない。
//
// 描き方は銅版画の彫りと同じで、**明るいところに線を入れ、暗いところは線を抜く**。
// 黒地なので、線を密に引いた面が浮かび、引かない所が闇に沈む。
// 目や口は「線を抜いた穴」として作る（塗りつぶしで隠さない）。
//
// **飾りは飾りに徹すること。** 文字の下に濃く敷かない——読みにくくなった時点で、
// 雰囲気のために中身を犠牲にしている（Ornament.jsx と同じ線）。

/** 楕円を横に切ったときの、その高さでの左右の端。外れていれば null */
function span(cx, cy, rx, ry, y) {
  const dy = (y - cy) / ry;
  if (Math.abs(dy) >= 1) return null;
  const half = rx * Math.sqrt(1 - dy * dy);
  return [cx - half, cx + half];
}

/** 区間から、穴の区間を引く（目・口はここで「線を抜いて」作る） */
function subtract(segments, hole) {
  const out = [];
  for (const [a, b] of segments) {
    const [ha, hb] = hole;
    if (hb <= a || ha >= b) {
      out.push([a, b]);
      continue;
    }
    if (ha > a) out.push([a, ha]);
    if (hb < b) out.push([hb, b]);
  }
  return out;
}

/**
 * 楕円を横線で彫る。holes に楕円を渡すと、その形に線が抜ける。
 * @param {{cx:number, cy:number, rx:number, ry:number, holes?:Array, step?:number,
 *          from?:number, to?:number, opacity?:number, width?:number}} spec
 */
function hatch(spec) {
  const {
    cx, cy, rx, ry, holes = [], step = 4, opacity = 1, width = 1,
    from = cy - ry, to = cy + ry,
  } = spec;
  const lines = [];
  for (let y = Math.ceil(from); y <= to; y += step) {
    const base = span(cx, cy, rx, ry, y);
    if (!base) continue;
    let segs = [base];
    for (const h of holes) {
      const cut = span(h.cx, h.cy, h.rx, h.ry, y);
      if (cut) segs = subtract(segs, cut);
    }
    // 端へ行くほど薄くする。平らな縞ではなく、丸みのある面に見せるため
    const t = (y - cy) / ry;
    const shade = opacity * (0.45 + 0.55 * Math.sqrt(Math.max(0, 1 - t * t)));
    for (const [x1, x2] of segs) {
      if (x2 - x1 < 0.8) continue;
      lines.push(
        <line key={`${y}-${x1.toFixed(1)}`} x1={x1} y1={y} x2={x2} y2={y} strokeWidth={width} opacity={shade} />,
      );
    }
  }
  return lines;
}

/** 三日月（口）を、上下2つの楕円の差で作る */
function crescent(cx, cy, rx, ry, lift) {
  return { cx, cy, rx, ry, cut: { cx, cy: cy - lift, rx, ry } };
}

/* ── ① 長い髪の面 ───────────────────────────── */
function Veil() {
  const face = { cx: 200, cy: 226, rx: 88, ry: 120 };
  const mouth = crescent(200, 274, 48, 30, 18);
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      {/* 髪と肩は線を抜いた闇。縁だけ細く出して形をわからせる */}
      <path
        d="M200 48 C 116 48 88 130 84 226 C 80 330 74 450 58 640 L 342 640 C 326 450 320 330 316 226 C 312 130 284 48 200 48 Z"
        opacity="0.4"
      />
      <path d="M126 640 C 140 520 142 430 140 340" opacity="0.24" />
      <path d="M274 640 C 260 520 258 430 260 340" opacity="0.24" />
      {/* 面は彫って浮かせる。目と口は線を抜いて作る */}
      {hatch({
        ...face,
        step: 3,
        opacity: 0.92,
        holes: [
          { cx: 168, cy: 206, rx: 29, ry: 16 },
          { cx: 232, cy: 206, rx: 29, ry: 16 },
          mouth,
        ],
      })}
      {/* 口の下側だけ薄く戻して、三日月に見せる */}
      {hatch({ cx: 200, cy: 274, rx: 48, ry: 30, from: 274, step: 3, opacity: 0.3 })}
      <ellipse cx="168" cy="206" rx="29" ry="16" opacity="0.5" />
      <ellipse cx="232" cy="206" rx="29" ry="16" opacity="0.5" />
    </g>
  );
}

/* ── ② 笑う面 ───────────────────────────────── */
function Grin() {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <ellipse cx="200" cy="212" rx="168" ry="182" opacity="0.3" />
      {/* 額のあたりだけ薄く彫って、丸い頭の面を出す */}
      {hatch({ cx: 200, cy: 186, rx: 166, ry: 154, step: 6, opacity: 0.2, to: 206 })}
      {/* 目は白く抜けた丸（線を密に彫る） */}
      {hatch({ cx: 142, cy: 192, rx: 27, ry: 27, step: 2.2, opacity: 1 })}
      {hatch({ cx: 258, cy: 192, rx: 27, ry: 27, step: 2.2, opacity: 1 })}
      {/* 口は横に長く、縦線で歯を彫る */}
      <path d="M72 288 C 128 380 272 380 328 288 C 272 316 128 316 72 288 Z" opacity="0.62" />
      {Array.from({ length: 17 }, (_, i) => {
        const x = 82 + i * 14.7;
        const t = (x - 200) / 126;
        const d = 29 * (1 - t * t);
        return <line key={x} x1={x} y1={294 + d * 0.15} x2={x} y2={294 + d * 1.6} strokeWidth="1.4" opacity="0.7" />;
      })}
      <path d="M72 288 C 134 306 266 306 328 288" opacity="0.55" />
      {/* 肩 */}
      <path d="M24 640 C 58 486 120 420 200 420 C 280 420 342 486 376 640" opacity="0.22" />
    </g>
  );
}

/* ── ③ 水面の目 ─────────────────────────────── */
function Water() {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      {/* 水から上だけが出ている頭 */}
      {hatch({
        cx: 200, cy: 232, rx: 118, ry: 148, step: 3.2, opacity: 0.5, to: 272,
        holes: [
          { cx: 154, cy: 212, rx: 28, ry: 28 },
          { cx: 246, cy: 212, rx: 28, ry: 28 },
        ],
      })}
      {/* 目は密に彫って、いちばん明るくする */}
      {hatch({ cx: 154, cy: 212, rx: 24, ry: 24, step: 1.2, opacity: 1, width: 1.3 })}
      {hatch({ cx: 246, cy: 212, rx: 24, ry: 24, step: 1.2, opacity: 1, width: 1.3 })}
      <circle cx="154" cy="212" r="28" opacity="0.5" />
      <circle cx="246" cy="212" r="28" opacity="0.5" />
      {/* 水面 */}
      <line x1="0" y1="272" x2="400" y2="272" opacity="0.55" />
      {[284, 298, 316, 340, 370, 406].map((y, i) => (
        <path
          key={y}
          d={`M${-20 + i * 6} ${y} C 110 ${y - 6} 290 ${y + 6} ${420 - i * 6} ${y}`}
          opacity={0.26 - i * 0.03}
        />
      ))}
      {/* 波紋 */}
      <ellipse cx="200" cy="282" rx="158" ry="12" opacity="0.24" />
      <ellipse cx="200" cy="300" rx="210" ry="17" opacity="0.16" />
    </g>
  );
}

/* ── ④ 能の面 ───────────────────────────────── */
function Noh() {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      {hatch({
        cx: 200, cy: 230, rx: 98, ry: 138, step: 2.8, opacity: 0.9,
        holes: [
          { cx: 166, cy: 206, rx: 23, ry: 9 },
          { cx: 234, cy: 206, rx: 23, ry: 9 },
          { cx: 200, cy: 296, rx: 26, ry: 10 },
        ],
      })}
      <ellipse cx="200" cy="230" rx="98" ry="138" opacity="0.45" />
      <line x1="200" y1="220" x2="200" y2="272" opacity="0.3" />
      {/* 眉 */}
      <path d="M138 178 C 152 168 176 168 188 176" opacity="0.5" />
      <path d="M262 178 C 248 168 224 168 212 176" opacity="0.5" />
      {/* 襟 */}
      <path d="M112 438 L 200 382 L 288 438" opacity="0.3" />
      <path d="M46 640 C 72 512 128 440 200 440 C 272 440 328 512 354 640" opacity="0.22" />
    </g>
  );
}

/* ── ⑤ フードの影 ───────────────────────────── */
function Hood() {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      {/* 頭巾の外側。中は闇のまま */}
      <path
        d="M200 40 C 108 40 62 122 58 232 C 54 342 44 480 26 640 L 374 640 C 356 480 346 342 342 232 C 338 122 292 40 200 40 Z"
        opacity="0.34"
      />
      {/* 頭巾の内側の縁 */}
      <path
        d="M200 96 C 140 96 112 156 112 226 C 112 302 148 350 200 350 C 252 350 288 302 288 226 C 288 156 260 96 200 96 Z"
        opacity="0.26"
      />
      {/* 影の奥の面。目は線を抜いて作る */}
      {hatch({
        cx: 200, cy: 222, rx: 74, ry: 104, step: 3, opacity: 0.7,
        holes: [
          { cx: 172, cy: 202, rx: 24, ry: 13 },
          { cx: 228, cy: 202, rx: 24, ry: 13 },
          { cx: 200, cy: 272, rx: 26, ry: 11 },
        ],
      })}
      <ellipse cx="172" cy="202" rx="24" ry="13" opacity="0.4" />
      <ellipse cx="228" cy="202" rx="24" ry="13" opacity="0.4" />
      {/* 肩 */}
      <path d="M14 640 C 46 500 110 428 200 428 C 290 428 354 500 386 640" opacity="0.2" />
    </g>
  );
}

/* ── ⑥ 二つの影 ─────────────────────────────── */
function Pair() {
  const head = (cx, cy, r, o) => (
    <>
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 1.24} opacity={o} />
      <path d={`M${cx - r * 2} 560 C ${cx - r * 1.7} ${cy + r * 3} ${cx - r} ${cy + r * 1.5} ${cx} ${cy + r * 1.5} C ${cx + r} ${cy + r * 1.5} ${cx + r * 1.7} ${cy + r * 3} ${cx + r * 2} 560`} opacity={o * 0.8} />
    </>
  );
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      {head(130, 224, 76, 0.3)}
      {head(294, 268, 64, 0.2)}
      {/* 手前の顔だけ彫って浮かせる */}
      {hatch({
        cx: 130, cy: 224, rx: 74, ry: 92, step: 3.2, opacity: 0.75,
        holes: [
          { cx: 106, cy: 206, rx: 19, ry: 10 },
          { cx: 156, cy: 206, rx: 19, ry: 10 },
          { cx: 131, cy: 264, rx: 23, ry: 9 },
        ],
      })}
      {hatch({ cx: 294, cy: 268, rx: 62, ry: 78, step: 5, opacity: 0.24 })}
    </g>
  );
}

/**
 * 地に敷ける面の一覧。**読みは必須**（目次・並びの共通ルールと同じ）。
 * 1件足せば、開くたびに出る候補が自動で増える。
 */
export const FIGURES = [
  { id: 'veil', name: '長い髪の面', reading: 'ながいかみのおもて', Draw: Veil },
  { id: 'grin', name: '笑う面', reading: 'わらうおもて', Draw: Grin },
  { id: 'water', name: '水面の目', reading: 'みなものめ', Draw: Water },
  { id: 'noh', name: '能の面', reading: 'のうのおもて', Draw: Noh },
  { id: 'hood', name: 'フードの影', reading: 'ふーどのかげ', Draw: Hood },
  { id: 'pair', name: '二つの影', reading: 'ふたつのかげ', Draw: Pair },
];

export const FIGURE_MAP = Object.fromEntries(FIGURES.map((f) => [f.id, f]));

/** 地に敷く1枚。文字の下なので、薄さは CSS（.figure-bg）で決める */
export default function FigureBackground({ id }) {
  const found = FIGURE_MAP[id] || FIGURES[0];
  const { Draw, name } = found;
  return (
    <div className="figure-bg" aria-hidden="true">
      <svg viewBox="0 0 400 640" preserveAspectRatio="xMidYMin slice" focusable="false" role="img" aria-label={name}>
        <Draw />
      </svg>
    </div>
  );
}
