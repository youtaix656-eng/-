import React, { useMemo, useState } from 'react';
import { PERIOD_KINDS, KIND_BY_ID, openPeriods, periodLength, PERIOD_NOTE } from '../lib/periods.js';
import { todayKey, formatKey } from '../lib/dates.js';
import { useFocusJump } from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// いつもと違う期間の印（提案6）。**印をつけるだけ**——
// 期間の中で症状がどうだったかを、アプリが判定しない（README 決まり1・3）。
// **周期を予測しない**（外れたときに不安にさせるだけ）。

export default function Periods({ store, onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const today = todayKey();
  const [kind, setKind] = useState('travel');
  const [from, setFrom] = useState(today);
  const [note, setNote] = useState('');
  const running = useMemo(() => openPeriods(store.periods), [store.periods]);
  const all = useMemo(() => [...store.periods].reverse(), [store.periods]);

  return (
    <div className="view">
      <header className="view-head">
        <h1>いつもと違う期間</h1>
        <p className="muted">旅行・薬が変わった・生理など、いつもと条件が違う期間に印をつけておけます。</p>
      </header>

      <div className="notice" id="period-note">
        <p>{PERIOD_NOTE}</p>
      </div>

      <section className="block" id="period-add">
        <div className="block-head">
          <h2>印をつける</h2>
        </div>
        <div className="choice-row" role="group" aria-label="種類">
          {PERIOD_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`chip${kind === k.id ? ' on' : ''}`}
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="muted small">始まり</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span className="muted small">ひとこと（任意）</span>
          <input type="text" value={note} placeholder="出張・薬が変わった、など" onChange={(e) => setNote(e.target.value)} />
        </label>
        <button
          type="button"
          className="solid"
          onClick={() => {
            if (store.addPeriod({ kind, from, note })) setNote('');
          }}
        >
          印をつける
        </button>
      </section>

      {running.length > 0 && (
        <section className="block" id="period-running">
          <div className="block-head">
            <h2>まだ終わっていない印</h2>
          </div>
          <ul className="flags">
            {running.map((p) => (
              <li key={p.id} id={`period-${p.id}`}>
                <strong>{(KIND_BY_ID[p.kind] || {}).label || p.kind}</strong>
                <span className="muted small">
                  {formatKey(p.from)} から（{periodLength(p, today)}日目）{p.note ? `／${p.note}` : ''}
                </span>
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => store.updatePeriod(p.id, { to: today })}
                >
                  きょうで終わりにする
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block" id="period-list">
        <div className="block-head">
          <h2>これまでの印</h2>
        </div>
        {all.length === 0 ? (
          <p className="muted">まだありません。</p>
        ) : (
          <ul className="flags">
            {all.map((p) => (
              <li key={p.id} id={`period-item-${p.id}`}>
                <strong>{(KIND_BY_ID[p.kind] || {}).label || p.kind}</strong>
                <span className="muted small">
                  {formatKey(p.from)}
                  {p.to ? ` 〜 ${formatKey(p.to)}` : ' 〜（続いています）'}
                  {p.note ? `／${p.note}` : ''}
                </span>
                <button type="button" className="ghost small" onClick={() => store.removePeriod(p.id)}>
                  この印を消す
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RedFlagLink onGo={onGo} />
    </div>
  );
}
