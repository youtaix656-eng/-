import React, { useMemo, useState } from 'react';
import DayEditor from './DayEditor.jsx';
import { BELLY_BY_ID } from '../data/scales.js';
import { emptyDay, hasRecord } from '../lib/days.js';
import {
  todayKey,
  monthStart,
  shiftMonth,
  daysInMonth,
  parseKey,
  toDate,
  formatKey,
} from '../lib/dates.js';
import { foodSuggestions } from '../lib/stats.js';
import { useFocusJump } from './useFocusJump.js';

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const pad = (n) => String(n).padStart(2, '0');

export default function Calendar({ store, onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const today = todayKey();
  const [month, setMonth] = useState(() => monthStart(today));
  const [selected, setSelected] = useState(today);
  const suggestions = useMemo(() => foodSuggestions(store.days, 8), [store.days]);

  const cells = useMemo(() => {
    const p = parseKey(month);
    if (!p) return [];
    const firstWeekday = toDate(month).getDay();
    const count = daysInMonth(month);
    const out = [];
    for (let i = 0; i < firstWeekday; i += 1) out.push(null);
    for (let d = 1; d <= count; d += 1) out.push(`${p.y}-${pad(p.m)}-${pad(d)}`);
    return out;
  }, [month]);

  const day = store.days[selected] || emptyDay(selected);

  return (
    <div className="view">
      <header className="view-head">
        <h1>カレンダー</h1>
      </header>

      <div className="month-bar">
        <button type="button" className="ghost" onClick={() => setMonth(shiftMonth(month, -1))}>
          ‹ 前の月
        </button>
        <strong>
          {parseKey(month).y}年{parseKey(month).m}月
        </strong>
        <button type="button" className="ghost" onClick={() => setMonth(shiftMonth(month, 1))}>
          次の月 ›
        </button>
      </div>

      <div className="cal" id="cal-grid">
        {WEEK.map((w) => (
          <div key={w} className="cal-w">
            {w}
          </div>
        ))}
        {cells.map((key, i) => {
          if (!key) return <div key={`e${i}`} className="cal-cell empty" />;
          const d = store.days[key];
          const step = d && d.belly ? BELLY_BY_ID[d.belly] : null;
          const recorded = hasRecord(d);
          return (
            <button
              key={key}
              type="button"
              className={`cal-cell${selected === key ? ' sel' : ''}${key === today ? ' today' : ''}`}
              onClick={() => setSelected(key)}
            >
              <span className="cal-n">{parseKey(key).d}</span>
              <span
                className="cal-mark"
                style={step ? { opacity: 0.15 + step.shade * 0.85 } : undefined}
                data-recorded={recorded ? 'yes' : 'no'}
              />
            </button>
          );
        })}
      </div>

      <div className="legend">
        <span>濃さ＝お腹の調子</span>
        {['very_easy', 'usual', 'very_hard'].map((id) => (
          <span key={id} className="legend-item">
            <span className="cal-mark" style={{ opacity: 0.15 + BELLY_BY_ID[id].shade * 0.85 }} />
            {BELLY_BY_ID[id].label}
          </span>
        ))}
        <span className="legend-item">
          <span className="cal-mark" data-recorded="no" />
          記録なし
        </span>
      </div>

      <section className="block">
        <div className="block-head">
          <h2>{formatKey(selected)}</h2>
          {hasRecord(day) && (
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                if (window.confirm('この日の記録を消しますか？（20秒のあいだは戻せます）')) {
                  store.removeDay(selected);
                }
              }}
            >
              この日を消す
            </button>
          )}
        </div>
        <DayEditor
          date={selected}
          day={day}
          store={store}
          suggestions={suggestions}
          onOpenRedFlags={() => onGo('redflags')}
        />
      </section>
    </div>
  );
}
