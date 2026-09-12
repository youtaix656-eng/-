// 円形の進み具合。線は細く、進んだ部分だけを白で見せる（休憩では灰色寄り）。

export function CircleProgress({
  progress,
  size = 260,
  stroke = 2,
  dim = false,
  children,
}: {
  /** 0〜1 */
  progress: number;
  size?: number;
  stroke?: number;
  /** 休憩・一時停止で明度を落とす */
  dim?: boolean;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className={dim ? 'ring dim' : 'ring'} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-inner">{children}</div>
    </div>
  );
}
