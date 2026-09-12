// VAS（0〜10）。数字を必ず一緒に出す（色だけに意味を持たせない）。

import type { Vas } from '../types/index.js';

interface Props {
  value: Vas | null;
  onChange: (v: Vas) => void;
}

const VALUES: Vas[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function VasInput({ value, onChange }: Props) {
  return (
    <div className="vas">
      <div className="vas-row" role="radiogroup" aria-label="痛みの強さ 0から10">
        {VALUES.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            className={`vas-btn${value === v ? ' on' : ''}`}
            onClick={() => onChange(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="vas-ends">
        <span>0＝痛みなし</span>
        <span>10＝想像できる最大の痛み</span>
      </div>
    </div>
  );
}
