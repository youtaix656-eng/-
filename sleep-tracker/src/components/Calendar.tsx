import { useState } from 'react';
import type { SleepRecord } from '../types/sleep';
import { todayISODate } from '../lib/time';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export default function Calendar({
  records,
  onOpenDate,
}: {
  records: SleepRecord[];
  onOpenDate: (date: string, existing: SleepRecord | null) => void;
}) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const byDate = new Map(records.map((r) => [r.date, r]));
  const startWeekday = new Date(cursor.year, cursor.month, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

  const cells: (number | null)[] = Array(startWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const total = c.year * 12 + c.month + delta;
      return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
    });
  }

  const todayISO = todayISODate();

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="前の月">
          ‹
        </button>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {cursor.year}年{cursor.month + 1}月
        </span>
        <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="次の月">
          ›
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--text-faint)' }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const iso = isoOf(cursor.year, cursor.month, d);
          const record = byDate.get(iso) ?? null;
          const hasData = Boolean(record && (record.coreSleep.start || record.naps.length > 0));
          const isToday = iso === todayISO;
          return (
            <button
              key={i}
              onClick={() => onOpenDate(iso, record)}
              aria-label={`${cursor.month + 1}月${d}日${hasData ? '（記録あり）' : ''}`}
              style={{
                aspectRatio: '1',
                borderRadius: 8,
                border: isToday ? '1px solid var(--text)' : '1px solid transparent',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                fontSize: 12,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>{d}</span>
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: hasData ? 'var(--text)' : 'transparent',
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
