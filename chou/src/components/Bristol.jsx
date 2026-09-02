import React from 'react';
import { BRISTOL } from '../data/scales.js';

// ブリストルスケールの絵。**画像ファイルを持たない**（その場に線を引く）。
// からかう形にしない・見て選べる形にする、の2つだけを守る。

function Shape({ n }) {
  const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' };
  switch (n) {
    case 1:
      return (
        <>
          {[[12, 16], [24, 12], [34, 18], [20, 24], [31, 26]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3.4" {...line} />
          ))}
        </>
      );
    case 2:
      return (
        <>
          <path d="M8 19 q2 -7 8 -6 q4 -5 9 0 q5 -4 9 1 q5 3 2 8 q-4 6 -12 5 q-9 1 -13 -3 q-4 -2 -3 -5z" {...line} />
          <path d="M18 13 v12 M27 13 v12" {...line} opacity="0.5" />
        </>
      );
    case 3:
      return (
        <>
          <rect x="7" y="13" width="34" height="12" rx="6" {...line} />
          <path d="M15 13 v12 M22 13 v12 M29 13 v12 M36 13 v12" {...line} opacity="0.55" />
        </>
      );
    case 4:
      return <rect x="6" y="14" width="36" height="10" rx="5" {...line} />;
    case 5:
      return (
        <>
          <rect x="7" y="14" width="9" height="10" rx="4.5" {...line} />
          <rect x="19" y="13" width="10" height="12" rx="5" {...line} />
          <rect x="32" y="15" width="9" height="9" rx="4.5" {...line} />
        </>
      );
    case 6:
      return (
        <path
          d="M8 22 q1 -6 6 -6 q1 -5 7 -4 q3 -4 8 -1 q6 -2 8 3 q5 2 3 7 q-3 4 -9 3 q-6 2 -12 0 q-8 1 -11 -2z"
          {...line}
        />
      );
    case 7:
      return (
        <>
          <path d="M6 24 q6 -4 11 0 q5 4 10 0 q6 -4 11 0" {...line} />
          <path d="M6 24 q4 5 12 5 h12 q8 0 10 -5" {...line} />
        </>
      );
    default:
      return null;
  }
}

export function BristolIcon({ n }) {
  return (
    <svg viewBox="0 0 48 36" className="bristol-icon" aria-hidden="true">
      <Shape n={n} />
    </svg>
  );
}

/** 1〜7 から選ぶ。選び直せる（もう一度押すと外れる） */
export default function BristolPicker({ value, onChange }) {
  return (
    <div className="bristol-row" role="group" aria-label="便のかたさ（ブリストルスケール）">
      {BRISTOL.map((b) => {
        const on = value === b.n;
        return (
          <button
            key={b.n}
            type="button"
            className={`bristol-btn${on ? ' on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(on ? null : b.n)}
          >
            <span className="bristol-n">{b.n}</span>
            <BristolIcon n={b.n} />
            <span className="bristol-label">{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { BRISTOL };
