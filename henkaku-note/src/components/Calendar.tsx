import { useMemo, useState } from 'react';
import { monthGrid, formatMonthJa, WEEKDAY_LABELS, addDays } from '../lib/date';
import { completionRate, toneFor } from '../lib/habits';
import type { AppState } from '../types';

interface Props {
  state: AppState;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}

/**
 * 月間カレンダー。マスの色は達成率で「夜色 → 朝焼け色」に変わる。
 * 数字ではなく色の変化で1か月の流れが見えるようにするのがこの画面の役目。
 */
export default function Calendar({ state, selected, today, onSelect }: Props) {
  const [cursor, setCursor] = useState(() => {
    const [y, m] = selected.split('-').map(Number);
    return { year: y, month0: m - 1 };
  });

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month0), [cursor]);

  const move = (delta: number) => {
    const d = new Date(cursor.year, cursor.month0 + delta, 1);
    setCursor({ year: d.getFullYear(), month0: d.getMonth() });
  };

  return (
    <div className="card">
      <div className="cal-head">
        <button type="button" className="icon-btn" aria-label="前の月" onClick={() => move(-1)}>‹</button>
        <span className="cal-title">{formatMonthJa(cursor.year, cursor.month0)}</span>
        <button type="button" className="icon-btn" aria-label="次の月" onClick={() => move(1)}>›</button>
      </div>

      <div className="cal-week" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
          <div className="wd" key={wd}>{WEEKDAY_LABELS[wd]}</div>
        ))}
      </div>

      <div className="cal-grid" role="grid">
        {cells.map((cell) => {
          const record = state.days[cell.key];
          const rate = completionRate(record, state.habits);
          const tone = toneFor(rate, Boolean(record));
          const day = Number(cell.key.slice(-2));
          return (
            <button
              key={cell.key}
              type="button"
              role="gridcell"
              className={`cal-cell${cell.inMonth ? '' : ' out'}${cell.key === today ? ' today' : ''}`}
              aria-pressed={cell.key === selected}
              aria-label={`${cell.key} 達成 ${Math.round(rate * 100)}%`}
              onClick={() => onSelect(cell.key)}
            >
              <span
                className="glow"
                style={{
                  background:
                    tone === 0
                      ? 'transparent'
                      : `linear-gradient(160deg, rgba(62,58,115,${0.35 + tone * 0.3}), rgba(232,163,61,${tone * 0.85}))`,
                }}
              />
              <span className="d">{day}</span>
              {record?.shift && <span className={`shift-dot ${record.shift}`} />}
            </button>
          );
        })}
      </div>

      <div className="legend">
        <span>夜</span>
        <span className="bar" />
        <span>朝焼け</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        マスの色は、その日の達成率です。下の点は<span className="tag ember">勤務</span>／
        <span className="tag">休み</span>。
      </p>
      <div className="row">
        <button type="button" className="btn slim secondary" onClick={() => onSelect(today)}>今日へ</button>
        <button type="button" className="btn slim ghost" onClick={() => onSelect(addDays(selected, -1))}>← 前日</button>
        <button type="button" className="btn slim ghost" onClick={() => onSelect(addDays(selected, 1))}>翌日 →</button>
      </div>
    </div>
  );
}
