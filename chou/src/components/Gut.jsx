import React from 'react';

// 腸のキャラクター。**画像ファイルを持たない**——その場に線を引く。
//
// 決めていること（README 決まり9）
//  - 表情は変えるが、**責める顔・怒る顔・泣く顔を持たない**。
//    調子が悪い日にキャラクターまで悲しむと、記録そのものが気まずくなる。
//  - 記録していない日も責めない。眠っている顔にして、待っているだけにする。

const FACES = {
  // 目のかたち・口のかたちだけで表す
  very_easy: { eyes: 'arch', mouth: 'M52 66 q8 7 16 0' },
  easy: { eyes: 'dot', mouth: 'M53 66 q7 5 14 0' },
  usual: { eyes: 'dot', mouth: 'M54 67 h12' },
  hard: { eyes: 'half', mouth: 'M53 68 q3.5 -4 7 0 q3.5 4 7 0' },
  very_hard: { eyes: 'line', mouth: 'M56 68 a4 3 0 1 0 8 0 a4 3 0 1 0 -8 0' },
  asleep: { eyes: 'closed', mouth: 'M56 68 h8' },
};

function Eyes({ kind }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' };
  if (kind === 'arch') {
    return (
      <>
        <path d="M46 55 q4 -5 8 0" {...stroke} />
        <path d="M66 55 q4 -5 8 0" {...stroke} />
      </>
    );
  }
  if (kind === 'closed') {
    return (
      <>
        <path d="M46 54 q4 5 8 0" {...stroke} />
        <path d="M66 54 q4 5 8 0" {...stroke} />
      </>
    );
  }
  if (kind === 'half') {
    return (
      <>
        <path d="M46 54 h8" {...stroke} />
        <path d="M66 54 h8" {...stroke} />
        <circle cx="50" cy="57" r="1.8" fill="currentColor" />
        <circle cx="70" cy="57" r="1.8" fill="currentColor" />
      </>
    );
  }
  if (kind === 'line') {
    return (
      <>
        <path d="M46 56 h8" {...stroke} />
        <path d="M66 56 h8" {...stroke} />
      </>
    );
  }
  return (
    <>
      <circle cx="50" cy="55" r="2.6" fill="currentColor" />
      <circle cx="70" cy="55" r="2.6" fill="currentColor" />
    </>
  );
}

/**
 * @param {string|null} mood お腹の段の id。記録が無ければ null（眠っている顔）
 */
export default function Gut({ mood, size = 132 }) {
  const face = FACES[mood] || FACES.asleep;
  return (
    <svg
      className="gut"
      viewBox="0 0 120 100"
      width={size}
      height={(size * 100) / 120}
      role="img"
      aria-label="腸のキャラクター"
    >
      {/* 腸のかたち（大腸の走り方をなぞった枠） */}
      <path
        d="M26 92 L26 38 Q26 22 42 22 L78 22 Q94 22 94 38 L94 92"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      {/* ひだ（内側の短い線） */}
      {[34, 46, 58, 70, 82].map((y) => (
        <React.Fragment key={y}>
          <path d={`M26 ${y} h7`} stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
          <path d={`M87 ${y} h7`} stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
        </React.Fragment>
      ))}
      <Eyes kind={face.eyes} />
      <path d={face.mouth} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

// 一言は lib/gutLine.js が単一の正（テストから実際の文字列を読めるようにするため）。
export { gutLine, GUT_LINES } from '../lib/gutLine.js';
