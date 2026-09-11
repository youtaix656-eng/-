import type { Scale5 } from '../types/index.js';

// 5段階の入力。**未入力（null）を0として扱わない**——もう一度押すと取り消せる。

export function ScaleInput({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: Scale5;
  onChange: (v: Scale5) => void;
}) {
  return (
    <div style={{ margin: '14px 0' }}>
      <label>{label}</label>
      <div className="scale">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={value === n ? 'on' : ''}
            aria-pressed={value === n}
            aria-label={`${label} ${n}`}
            onClick={() => onChange(value === n ? null : (n as Scale5))}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="scale-legend">
        <span>1 {low}</span>
        <span>5 {high}</span>
      </div>
    </div>
  );
}
