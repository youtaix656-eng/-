import { useMemo, useState } from 'react';
import { completedCount, streakDays, tagBreakdown, totalMinutes, weekBars, type Range } from '../lib/stats.js';
import { formatHm, formatMinutes, formatShort, todayKey } from '../lib/date.js';
import type { AppState } from '../types/index.js';

const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: '今日' },
  { id: 'week', label: '週' },
  { id: 'month', label: '月' },
];

export function StatsView({ state, now }: { state: AppState; now: number }) {
  const [range, setRange] = useState<Range>('today');
  const today = todayKey(now);
  const total = useMemo(() => totalMinutes(state.records, range, today), [state.records, range, today]);
  const done = useMemo(() => completedCount(state.records, range, today), [state.records, range, today]);
  const streak = useMemo(() => streakDays(state.records, today), [state.records, today]);
  const bars = useMemo(() => weekBars(state.records, today), [state.records, today]);
  const tags = useMemo(() => tagBreakdown(state.records, range, today), [state.records, range, today]);
  const max = Math.max(1, ...bars.map((b) => b.minutes));

  return (
    <section className="view" aria-label="記録">
      <h2 className="view-title">記録</h2>
      <div className="tabs" role="tablist" aria-label="期間">
        {RANGES.map((r) => (
          <button key={r.id} role="tab" aria-selected={range === r.id} className={range === r.id ? 'tab on' : 'tab'} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="big-stat">
        <div className="label">集中した合計</div>
        <div className="value">{formatHm(total)}<span className="u">h</span></div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="v">{streak}<span className="u">日</span></div>
          <div className="k">連続達成日数</div>
        </div>
        <div className="stat">
          <div className="v">{done}<span className="u">回</span></div>
          <div className="k">完了ポモ数</div>
        </div>
      </div>

      <h3 className="label">週の推移</h3>
      <div className="week-chart" role="img" aria-label="今週の日ごとの集中時間">
        {bars.map((b) => (
          <div key={b.date} className={b.isToday ? 'col today' : 'col'}>
            <div className="bar-area">
              <div className="bar" style={{ height: `${Math.max(b.minutes > 0 ? 3 : 0, (b.minutes / max) * 100)}%` }} title={`${b.label} ${formatMinutes(b.minutes)}`} />
            </div>
            <div className="wd">{b.weekday}</div>
            <div className="dt">{b.label}</div>
          </div>
        ))}
      </div>

      <h3 className="label">タグ別内訳</h3>
      {tags.length === 0 ? (
        <p className="quiet">この期間の記録はまだありません</p>
      ) : (
        <ul className="rows">
          {tags.map((t) => (
            <li key={t.tag} className="row-item">
              <span className="name">{t.tag}</span>
              <span className="val">{formatShort(t.minutes)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
