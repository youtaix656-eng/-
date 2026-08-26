// ウロボロスの印章。**画像を使わず線で描く**（項目01）。
//
// 元は 1536px の JPEG（393KB）を 108〜280px で表示していて、
// 初回転送の 79% を1枚が占めていた。ベクタなら転送はほぼゼロで、
// 拡大しても粗くならず、肖像（Portrait.jsx）と同じ世界観に揃う。

import { memo } from 'react';

const RING = 34; // 蛇の輪の半径
const SCALES = 44; // 鱗の刻みの数

function SealBase({ size = 120, detail = 'full', className = '', title = '' }) {
  const full = detail === 'full';

  return (
    <svg
      className={`seal-svg ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : 'true'}
    >
      {/* 外枠（角の丸い方形＋二重線） */}
      <g fill="none" stroke="rgba(255,255,255,0.34)" strokeWidth="0.7">
        <rect x="4" y="4" width="112" height="112" rx="14" />
        <rect x="8" y="8" width="104" height="104" rx="11" strokeWidth="0.45" />
      </g>

      {/* 四方の十字（天体図の意匠） */}
      {full && (
        <g fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="0.6">
          {[
            [60, 15],
            [60, 105],
            [15, 60],
            [105, 60],
          ].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`}>
              <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy} />
              <line x1={cx} y1={cy - 5} x2={cx} y2={cy + 5} />
              <circle cx={cx} cy={cy} r="1.8" />
            </g>
          ))}
        </g>
      )}

      {/* 太陽と月（左上・右上） */}
      {full && (
        <g fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.7">
          <circle cx="24" cy="24" r="5" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <line
                key={i}
                x1={24 + Math.cos(a) * 6.5}
                y1={24 + Math.sin(a) * 6.5}
                x2={24 + Math.cos(a) * 9}
                y2={24 + Math.sin(a) * 9}
                strokeWidth="0.55"
              />
            );
          })}
          <path d="M100,17 a7.5,7.5 0 1,0 0,14 a6,6 0 1,1 0,-14 Z" />
        </g>
      )}

      {/* ウロボロス：自らの尾を咥える蛇 */}
      <g fill="none" stroke="#ffffff" strokeLinecap="round">
        <circle cx="60" cy="62" r={RING} strokeWidth="4.6" opacity="0.14" />
        <circle cx="60" cy="62" r={RING + 2.4} strokeWidth="0.9" />
        <circle cx="60" cy="62" r={RING - 2.4} strokeWidth="0.9" />

        {/* 鱗（輪に沿った短い刻み） */}
        {full &&
          Array.from({ length: SCALES }).map((_, i) => {
            const a = (i / SCALES) * Math.PI * 2 - Math.PI / 2;
            // 頭のあたりは鱗を描かない
            if (a > -Math.PI / 2 - 0.5 && a < -Math.PI / 2 + 0.75) return null;
            return (
              <line
                key={i}
                x1={60 + Math.cos(a) * (RING - 2.2)}
                y1={62 + Math.sin(a) * (RING - 2.2)}
                x2={60 + Math.cos(a) * (RING + 2.2)}
                y2={62 + Math.sin(a) * (RING + 2.2)}
                strokeWidth="0.5"
                opacity="0.55"
              />
            );
          })}

        {/* 頭（上部・右向き）。輪より一回り大きく描いて、蛇だと分かるようにする */}
        <path
          d="M55,27 C63,22.5 75,23.5 81,29.5 C85.5,34 84,40 78.5,41 C73,42 67,39.5 62.5,35.5"
          strokeWidth="1.5"
          fill="#000"
        />
        {/* 顎（尾を咥えている口） */}
        <path d="M81,31.5 C76,31.5 69,30.5 63,28.5" strokeWidth="1.1" />
        <path d="M79.5,35.5 C75,35.5 69,34.5 64.5,33" strokeWidth="0.8" opacity="0.8" />
        {/* 目 */}
        <circle cx="70" cy="28.8" r="1.5" fill="#fff" stroke="none" />
        <circle cx="70" cy="28.8" r="2.6" strokeWidth="0.7" />
        {/* 尾（口へ吸い込まれていく） */}
        <path d="M52,29.5 C56,26.5 60,25.5 64,26.5" strokeWidth="1.2" opacity="0.9" />
      </g>

      {/* 中心：六芒星と眼 */}
      <g fill="none" stroke="#ffffff" strokeWidth="0.75">
        <circle cx="60" cy="62" r="17.5" opacity="0.7" />
        <polygon points="60,47.5 72.6,69 47.4,69" opacity="0.85" />
        <polygon points="60,76.5 47.4,55 72.6,55" opacity="0.85" />
        {full &&
          [
            [60, 47.5],
            [72.6, 69],
            [47.4, 69],
            [60, 76.5],
            [47.4, 55],
            [72.6, 55],
          ].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="1.1" fill="#fff" stroke="none" />)}
        {/* 眼 */}
        <path d="M52,62 C55,57.6 65,57.6 68,62 C65,66.4 55,66.4 52,62 Z" strokeWidth="0.9" />
        <circle cx="60" cy="62" r="2.9" strokeWidth="0.8" />
        <circle cx="60" cy="62" r="1.25" fill="#fff" stroke="none" />
      </g>

      {/* 下部の三角（錬金術の記号） */}
      {full && (
        <g fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.7">
          <polygon points="24,102 32,88 40,102" />
          <line x1="27" y1="97" x2="37" y2="97" />
          <circle cx="96" cy="95" r="8" />
          <circle cx="96" cy="95" r="1.4" fill="#fff" stroke="none" />
        </g>
      )}
    </svg>
  );
}

// ホームは仕事や知識が変わるたびに描き直されるが、印章は毎回同じ。
const Seal = memo(SealBase);
export default Seal;
