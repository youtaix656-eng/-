import { useMemo, useState } from 'react';
import { Icon } from './Icons.js';
import { actions } from '../lib/useStore.js';
import { datesWithEntries, entriesOn, sortExams } from '../lib/schedule.js';
import { daysUntil } from '../lib/stats.js';
import { daysInMonth, isValidKey, longDate, todayKey, WEEKDAYS, pad } from '../lib/date.js';
import { scheduleTypeLabel } from '../data/scheduleTypes.js';
import type { AppState, DateKey } from '../types/index.js';

export function CalendarView({ state, now, onNavigate }: { state: AppState; now: number; onNavigate: (v: string) => void }) {
  const today = todayKey(now);
  const [cursor, setCursor] = useState(() => today.slice(0, 7)); // 'YYYY-MM'
  const [selected, setSelected] = useState<DateKey>(today);
  const [examOpen, setExamOpen] = useState(false);
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');

  const year = Number(cursor.slice(0, 4));
  const month = Number(cursor.slice(5, 7));
  const marks = useMemo(() => datesWithEntries(state.schedule, year, month), [state.schedule, year, month]);
  const exams = useMemo(() => sortExams(state.exams, today), [state.exams, today]);
  const examDays = useMemo(() => new Set(state.exams.map((e) => e.date)), [state.exams]);
  const dayEntries = useMemo(() => entriesOn(state.schedule, selected), [state.schedule, selected]);

  const first = new Date(year, month - 1, 1).getDay();
  const count = daysInMonth(year, month);
  const cells: (DateKey | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setCursor(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };

  const nearest = exams.find((e) => e.date >= today) ?? null;

  const addExam = () => {
    if (!examName.trim() || !isValidKey(examDate)) return;
    actions.addExam({ name: examName.trim(), date: examDate });
    setExamName('');
    setExamDate('');
    setExamOpen(false);
  };

  return (
    <section className="view" aria-label="カレンダー">
      <h2 className="view-title">カレンダー</h2>
      <div className="card exam">
        {nearest ? (
          <>
            <div className="exam-head"><Icon name="flag" size={16} /> <span>{nearest.name}</span></div>
            <div className="exam-date">{longDate(nearest.date)}</div>
            <div className="exam-left"><span className="n">{daysUntil(nearest.date, today)}</span><span className="u">日</span></div>
            <div className="quiet">残り日数</div>
          </>
        ) : (
          <div className="quiet"><Icon name="flag" size={16} /> 試験日・模試の日程は未登録です</div>
        )}
        {exams.length > (nearest ? 1 : 0) && (
          <ul className="rows compact">
            {exams.filter((e) => e !== nearest).map((e) => (
              <li key={e.id} className="row-item">
                <span className="name">{e.name}</span>
                <span className="val">{e.date}{e.date < today ? '（終了）' : `・あと${daysUntil(e.date, today)}日`}</span>
                <button className="icon-btn" onClick={() => actions.deleteExam(e.id)} aria-label={`${e.name} を削除`}><Icon name="trash" size={16} /></button>
              </li>
            ))}
          </ul>
        )}
        {nearest && (
          <button className="icon-btn corner" onClick={() => actions.deleteExam(nearest.id)} aria-label={`${nearest.name} を削除`}><Icon name="trash" size={16} /></button>
        )}
        {examOpen ? (
          <div className="form">
            <label>試験名<input value={examName} onChange={(e) => setExamName(e.target.value)} maxLength={60} placeholder="例：第35回 国家試験" /></label>
            <label>日付<input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} /></label>
            <div className="row">
              <button className="btn" onClick={addExam} disabled={!examName.trim() || !isValidKey(examDate)}>追加</button>
              <button className="btn ghost" onClick={() => setExamOpen(false)}>閉じる</button>
            </div>
          </div>
        ) : (
          <button className="link faint" onClick={() => setExamOpen(true)}><Icon name="plus" size={13} /> 試験日を追加</button>
        )}
      </div>

      <div className="month-head">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="前の月"><Icon name="back" /></button>
        <div className="month">{year}年{month}月</div>
        <button className="icon-btn" onClick={() => move(1)} aria-label="次の月"><Icon name="chevron" /></button>
      </div>

      <div className="cal" role="grid" aria-label={`${year}年${month}月`}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-wd" role="columnheader">{w}</div>
        ))}
        {cells.map((key, i) =>
          key ? (
            <button
              key={key}
              role="gridcell"
              aria-selected={key === selected}
              className={['cal-day', key === selected ? 'sel' : '', key === today ? 'today' : ''].join(' ')}
              onClick={() => setSelected(key)}
            >
              <span className="d">{Number(key.slice(8, 10))}</span>
              <span className="marks">
                {marks.has(key) && <span className="mark" aria-label="予定あり" />}
                {examDays.has(key) && <span className="mark exam" aria-label="試験日" />}
              </span>
            </button>
          ) : (
            <div key={`e${i}`} className="cal-day empty" />
          ),
        )}
      </div>

      <h3 className="label">{longDate(selected)}</h3>
      {dayEntries.length === 0 ? (
        <p className="quiet">予定はありません。<button className="link" onClick={() => onNavigate('schedule')}>スケジュールを登録する</button></p>
      ) : (
        <ul className="rows">
          {dayEntries.map((e) => (
            <li key={e.id} className="row-item sched">
              <span className="band" />
              <span className="name">{scheduleTypeLabel(e.type)}{e.memo ? `・${e.memo}` : ''}</span>
              <span className="val">{e.startTime}–{e.endTime}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
