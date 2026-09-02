import React, { useMemo } from 'react';
import Gut, { gutLine } from './Gut.jsx';
import DayEditor from './DayEditor.jsx';
import { emptyDay, hasRecord } from '../lib/days.js';
import { lastKeys, todayKey, formatKey } from '../lib/dates.js';
import { recordedTotal, fillOf, foodSuggestions } from '../lib/stats.js';

export default function Home({ store, onGo }) {
  const today = todayKey();
  const day = store.days[today] || emptyDay(today);
  const recordedToday = hasRecord(day);

  const total = useMemo(() => recordedTotal(store.days), [store.days]);
  const fill = useMemo(() => fillOf(store.days, lastKeys(14, today)), [store.days, today]);
  const suggestions = useMemo(() => foodSuggestions(store.days, 8), [store.days]);

  return (
    <div className="view">
      <header className="view-head">
        <h1>きょう</h1>
        <p className="muted">{formatKey(today)}</p>
      </header>

      <section className="gut-card">
        <Gut mood={recordedToday ? day.belly : null} />
        <p className="gut-line">{gutLine(day.belly, { recordedToday })}</p>
      </section>

      <DayEditor
        date={today}
        day={day}
        store={store}
        suggestions={suggestions}
        onOpenRedFlags={() => onGo('redflags')}
      />

      <section className="block">
        <div className="block-head">
          <h2>これまで</h2>
        </div>
        <p>
          記録した日 <strong>{total}日</strong>
        </p>
        <div className="fill-row" aria-label={`この2週間で記録した日 ${fill.done}日 / ${fill.total}日`}>
          {fill.marks.map((on, i) => (
            <span key={lastKeys(14, today)[i]} className={`fill-dot${on ? ' on' : ''}`} />
          ))}
        </div>
        <p className="muted small">
          この2週間で {fill.done} / {fill.total}日。
          連続日数は数えていません——お腹の調子は自分で決められるものではないので、
          途切れた日が「怠けた日」に見えないようにしています。
        </p>
      </section>
    </div>
  );
}
