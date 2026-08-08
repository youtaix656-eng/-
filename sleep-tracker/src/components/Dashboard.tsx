import { useMemo, useState } from 'react';
import type { SleepRecord } from '../types/sleep';
import { groggyHourGrid, napEffectSummary, wakeStudyCorrelation, wakeStudyMatrix } from '../lib/analysis';
import { todayISODate } from '../lib/time';

type RangeDays = 7 | 30;

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

export default function Dashboard({ records }: { records: SleepRecord[] }) {
  const [range, setRange] = useState<RangeDays>(7);

  const dates = useMemo(() => lastNDates(range), [range]);
  const byDate = useMemo(() => new Map(records.map((r) => [r.date, r])), [records]);
  const inRange = useMemo(() => records.filter((r) => dates.includes(r.date)), [records, dates]);

  const hoursSeries = dates.map((d) => byDate.get(d)?.totalSleepHours ?? 0);
  const maxHours = Math.max(6, ...hoursSeries);
  const avgHours = inRange.length ? Math.round((hoursSeries.reduce((a, b) => a + b, 0) / dates.length) * 10) / 10 : 0;

  const grid = groggyHourGrid(inRange);
  const maxGroggy = Math.max(1, ...grid.map((b) => b.count * b.avgIntensity));

  const napFx = napEffectSummary(inRange);
  const corr = wakeStudyCorrelation(inRange);
  const matrix = wakeStudyMatrix(inRange);
  const maxMatrix = Math.max(1, ...matrix.flat());

  if (records.length === 0) {
    return <div className="empty-state">記録が貯まるとここに睡眠の傾向が表示されます。</div>;
  }

  return (
    <>
      <div className="tabs">
        <button className={range === 7 ? 'active' : ''} onClick={() => setRange(7)}>
          7日
        </button>
        <button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>
          30日
        </button>
      </div>

      <div className="card">
        <div className="card-label">合計睡眠時間の推移（平均 {avgHours}h）</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: range === 7 ? 6 : 2, height: 96, marginTop: 8 }}>
          {hoursSeries.map((h, i) => (
            <div
              key={dates[i]}
              title={`${dates[i]}: ${h}h`}
              style={{
                flex: 1,
                height: `${Math.max(2, (h / maxHours) * 100)}%`,
                borderRadius: '4px 4px 2px 2px',
                background:
                  dates[i] === todayISODate()
                    ? 'var(--amber)'
                    : h > 0
                      ? 'linear-gradient(180deg, var(--sleep), var(--sleep-soft))'
                      : 'var(--border-soft)',
              }}
            />
          ))}
        </div>
        {range === 7 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {dates.map((d) => (
              <div key={d} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: 'var(--text-faint)' }}>
                {Number(d.slice(8, 10))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <div className="section-title">モヤの発生傾向（時間帯別）</div>
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2 }}>
            {grid.map((b) => (
              <div
                key={b.hour}
                title={b.count > 0 ? `${b.hour}時台: ${b.count}件・平均強度${b.avgIntensity.toFixed(1)}` : `${b.hour}時台: 記録なし`}
                style={{
                  paddingTop: '100%',
                  borderRadius: 2,
                  background: 'var(--moya)',
                  opacity: b.count === 0 ? 0.08 : 0.15 + 0.75 * ((b.count * b.avgIntensity) / maxGroggy),
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9.5, color: 'var(--text-faint)' }}>
            <span>0時</span>
            <span>12時</span>
            <span>23時</span>
          </div>
        </div>
      </div>

      <div className="field">
        <div className="section-title">仮眠の効果</div>
        <div className="card">
          {napFx.total === 0 ? (
            <div className="subtle">仮眠の記録がまだありません。</div>
          ) : (
            <>
              <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(napFx.refreshed / napFx.total) * 100}%`, background: 'var(--nap)' }} />
                <div style={{ width: `${(napFx.neutral / napFx.total) * 100}%`, background: 'var(--sleep)' }} />
                <div style={{ width: `${(napFx.groggy / napFx.total) * 100}%`, background: 'var(--moya)' }} />
              </div>
              <div className="pill-row" style={{ marginTop: 10 }}>
                <span className="pill" style={{ borderColor: 'var(--nap)', color: 'var(--nap)' }}>
                  すっきり {napFx.refreshed}
                </span>
                <span className="pill" style={{ borderColor: 'var(--sleep)', color: 'var(--sleep)' }}>
                  ふつう {napFx.neutral}
                </span>
                <span className="pill" style={{ borderColor: 'var(--moya)', color: 'var(--moya)' }}>
                  まだ眠い {napFx.groggy}
                </span>
              </div>
              <div className="subtle" style={{ marginTop: 8 }}>
                すっきり率 {Math.round(napFx.refreshedRate * 100)}%（全{napFx.total}回中）
              </div>
            </>
          )}
        </div>
      </div>

      <div className="field">
        <div className="section-title">起床の状態 × 学習パフォーマンス</div>
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {matrix.map((row, wakeIdx) =>
              row.map((count, perfIdx) => (
                <div
                  key={`${wakeIdx}-${perfIdx}`}
                  title={`起床${wakeIdx + 1} × 学習${perfIdx + 1}: ${count}件`}
                  style={{
                    paddingTop: '100%',
                    borderRadius: 3,
                    background: 'var(--amber)',
                    opacity: count === 0 ? 0.08 : 0.2 + 0.7 * (count / maxMatrix),
                  }}
                />
              ))
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5, color: 'var(--text-faint)' }}>
            <span>横軸: 学習パフォーマンス（低→高）</span>
          </div>
          <div className="subtle" style={{ marginTop: 6 }}>
            {corr === null ? '相関を出すにはあと数件記録が必要です。' : `相関係数の目安: ${corr.toFixed(2)}（${corrLabel(corr)}）`}
          </div>
        </div>
      </div>
    </>
  );
}

function corrLabel(corr: number): string {
  const abs = Math.abs(corr);
  if (abs < 0.2) return 'ほぼ相関なし';
  if (abs < 0.5) return corr > 0 ? '弱い正の相関' : '弱い負の相関';
  return corr > 0 ? '強めの正の相関' : '強めの負の相関';
}
