import React, { useMemo, useState } from 'react';
import {
  upcomingVisits,
  pastVisits,
  visitLine,
  nextVisit,
  carryOverText,
  NO_REMINDER_NOTE,
  VISIT_NOTE,
  AFTER_NOTE,
} from '../lib/visits.js';
import { todayKey, formatKey } from '../lib/dates.js';
import { useFocusJump } from './useFocusJump.js';
import RedFlagLink from './RedFlagLink.jsx';

// 通院の予定・聞きたいこと・受診のあと（提案14〜16）。
// **通知は鳴らさない**（サーバーを持たないので約束できない。README 決まり6）。

function VisitCard({ visit, store, onGo }) {
  const [q, setQ] = useState('');
  const add = () => {
    const text = q.trim();
    if (!text) return;
    store.addQuestion(visit.id, text);
    setQ('');
  };
  return (
    <div className="cand" id={`visit-${visit.id}`}>
      <div className="block-head">
        <h3>{formatKey(visit.on)}</h3>
        <button type="button" className="ghost small" onClick={() => store.removeVisit(visit.id)}>
          この予定を消す
        </button>
      </div>

      <label className="field">
        <span className="muted small">どこで（任意）</span>
        <input
          type="text"
          value={visit.place}
          placeholder="かかりつけの内科"
          onChange={(e) => store.updateVisit(visit.id, { place: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="muted small">何のために（任意）</span>
        <input
          type="text"
          value={visit.purpose}
          placeholder="お腹の調子の相談"
          onChange={(e) => store.updateVisit(visit.id, { purpose: e.target.value })}
        />
      </label>

      <div className="block-head">
        <h4>聞きたいこと</h4>
      </div>
      {visit.questions.length === 0 ? (
        <p className="muted small">まだありません。思いついたときに足しておくと、受診メモに一緒に出せます。</p>
      ) : (
        <ul className="flags">
          {visit.questions.map((item) => (
            <li key={item.id}>
              <label className="mark">
                <input
                  type="checkbox"
                  checked={item.asked}
                  onChange={() => store.toggleQuestion(visit.id, item.id)}
                />
                <span>{item.text}</span>
              </label>
              <button
                type="button"
                className="ghost small"
                onClick={() => store.removeQuestion(visit.id, item.id)}
              >
                消す
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="meal-add">
        <label className="sr-only" htmlFor={`q-${visit.id}`}>
          聞きたいこと
        </label>
        <input
          id={`q-${visit.id}`}
          type="text"
          value={q}
          placeholder="いまの薬を続けていいか"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
        <button type="button" className="solid" onClick={add}>
          足す
        </button>
      </div>

      <div className="block-head">
        <h4>受診のあと</h4>
      </div>
      <label className="mark">
        <input
          type="checkbox"
          checked={visit.after.done}
          onChange={() => store.updateVisit(visit.id, { after: { ...visit.after, done: !visit.after.done } })}
        />
        <span>受診した</span>
      </label>
      {visit.after.done && (
        <>
          <label className="field">
            <span className="muted small">言われたこと（書いた言葉のまま残ります）</span>
            <textarea
              rows="3"
              value={visit.after.said}
              onChange={(e) => store.updateVisit(visit.id, { after: { ...visit.after, said: e.target.value } })}
            />
          </label>
          <label className="field">
            <span className="muted small">出された薬</span>
            <textarea
              rows="2"
              value={visit.after.meds}
              onChange={(e) => store.updateVisit(visit.id, { after: { ...visit.after, meds: e.target.value } })}
            />
          </label>
          <label className="field">
            <span className="muted small">つぎの予定（任意）</span>
            <input
              type="date"
              value={visit.after.nextOn}
              onChange={(e) => store.updateVisit(visit.id, { after: { ...visit.after, nextOn: e.target.value } })}
            />
          </label>
          {visit.after.nextOn && (
            <button
              type="button"
              className="ghost small"
              onClick={() => store.addVisit({ on: visit.after.nextOn, place: visit.place })}
            >
              つぎの予定として足す
            </button>
          )}
          {carryOverText(visit) && (
            <button type="button" className="ghost small" onClick={() => onGo('visitnote', 'note-extra')}>
              受診メモへ引き継ぐ
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function Visits({ store, onGo, focus, onFocusDone }) {
  useFocusJump(focus, onFocusDone);
  const today = todayKey();
  const [on, setOn] = useState('');
  const coming = useMemo(() => upcomingVisits(store.visits, today), [store.visits, today]);
  const past = useMemo(() => pastVisits(store.visits, today), [store.visits, today]);
  const next = useMemo(() => nextVisit(store.visits, today), [store.visits, today]);

  return (
    <div className="view">
      <header className="view-head">
        <h1>通院</h1>
        <p className="muted">{visitLine(next, today)}</p>
      </header>

      <div className="notice" id="visit-no-reminder">
        <p>{NO_REMINDER_NOTE}</p>
      </div>

      <section className="block" id="visit-add">
        <div className="block-head">
          <h2>予定を足す</h2>
        </div>
        <div className="meal-add">
          <label className="sr-only" htmlFor="visit-on">
            通院の日
          </label>
          <input id="visit-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
          <button
            type="button"
            className="solid"
            onClick={() => {
              if (store.addVisit({ on })) setOn('');
            }}
          >
            足す
          </button>
        </div>
        <p className="muted small">{VISIT_NOTE}</p>
      </section>

      <section className="block" id="visit-coming">
        <div className="block-head">
          <h2>これから</h2>
        </div>
        {coming.length === 0 ? (
          <p className="muted">予定は入っていません。</p>
        ) : (
          coming.map((v) => <VisitCard key={v.id} visit={v} store={store} onGo={onGo} />)
        )}
      </section>

      <section className="block" id="visit-past">
        <div className="block-head">
          <h2>済んだもの</h2>
        </div>
        <p className="muted small">{AFTER_NOTE}</p>
        {past.length === 0 ? (
          <p className="muted">まだありません。</p>
        ) : (
          past.map((v) => <VisitCard key={v.id} visit={v} store={store} onGo={onGo} />)
        )}
      </section>

      <RedFlagLink onGo={onGo} />
    </div>
  );
}
