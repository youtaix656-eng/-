import { useMemo } from 'react';
import { WEEKDAYS, toKey, fromKey, todayKey } from '../lib/date.js';
import { dayStatus } from '../lib/streak.js';
import type { AppState, DateKey } from '../types/index.js';

// カレンダー（緑＝継続／赤＝リラプス）。
// ⚠ 色だけに意味を持たせない：印の形も変える（丸／四角）し、凡例を必ず出す。
// ⚠ 空白の日を「サボった日」と書かない——記録していないだけかもしれない。

export function CalendarGrid({
  state,
  month,
  now,
  onPick,
  selected,
}: {
  state: AppState;
  /** 'YYYY-MM-01' */
  month: DateKey;
  now: number;
  onPick: (date: DateKey) => void;
  selected: DateKey | null;
}) {
  const cells = useMemo(() => {
    const first = fromKey(month);
    first.setDate(1);
    const lead = first.getDay();
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const list: (DateKey | null)[] = [];
    for (let i = 0; i < lead; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(toKey(new Date(first.getFullYear(), first.getMonth(), d)));
    }
    return list;
  }, [month]);

  const today = todayKey(now);

  return (
    <div>
      <div className="cal-grid" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-mute)' }}>
            {w}
          </div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((key, i) => {
          if (!key) return <div key={`e${i}`} className="cal-cell empty" />;
          const status = dayStatus(state, key, now);
          const rec = state.days[key];
          const hasNote = !!rec && (rec.journal.trim().length > 0 || rec.mood != null || rec.body != null || rec.focus != null);
          const cls = [
            'cal-cell',
            status === 'streak' ? 'streak' : '',
            status === 'relapse' ? 'relapse' : '',
            key === today ? 'today' : '',
            hasNote ? 'has-note' : '',
            selected === key ? 'sel' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const label = `${key}${status === 'relapse' ? '・リラプスの記録あり' : status === 'streak' ? '・継続中' : ''}`;
          return (
            <button key={key} type="button" className={cls} onClick={() => onPick(key)} aria-label={label}>
              {Number(key.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="cal-legend">
        <span><i className="dot-ok" /> 継続していた日</span>
        <span><i className="dot-ng" /> リラプスを記録した日</span>
        <span>太字＝その日の記録あり</span>
      </div>
      <p className="small">印の無い日は「記録していない日」です。続けられなかった日という意味ではありません。</p>
    </div>
  );
}
