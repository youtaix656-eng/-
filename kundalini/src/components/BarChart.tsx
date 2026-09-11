import type { CountRow } from '../lib/analysis.js';

// 横棒グラフ（自前のSVG。グラフのライブラリを持たない＝外部依存を増やさない）。
// ⚠ 件数が少ないときは「多い所」を強調しない（1件の偏りが傾向に見えるため）。

export function BarChart({ rows, highlight }: { rows: CountRow[]; highlight: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const rowH = 26;
  const labelW = 92;
  const height = rows.length * rowH + 6;
  return (
    <svg className="chart" viewBox={`0 0 320 ${height}`} role="img" aria-label="件数のグラフ">
      {rows.map((r, i) => {
        const y = i * rowH + 4;
        const w = (r.count / max) * (320 - labelW - 28);
        return (
          <g key={r.id}>
            <text x="0" y={y + 13} dominantBaseline="middle">{r.label}</text>
            <rect
              className={highlight && r.count === max && max > 1 ? 'bar hot' : 'bar'}
              x={labelW}
              y={y + 4}
              width={Math.max(r.count > 0 ? 2 : 0, w)}
              height={12}
              rx="3"
            />
            <text x={labelW + Math.max(2, w) + 6} y={y + 13} dominantBaseline="middle">{r.count}</text>
          </g>
        );
      })}
    </svg>
  );
}
