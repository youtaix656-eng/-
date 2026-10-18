import { useMemo, useState } from 'react';
import { Icon } from './Icons.js';
import { actions } from '../lib/useStore.js';
import { thisWeek, validateEntry } from '../lib/schedule.js';
import { shortDate, todayKey, WEEKDAYS, weekdayOf } from '../lib/date.js';
import { REPEAT_KINDS, SCHEDULE_TYPES, repeatLabel, scheduleTypeLabel } from '../data/scheduleTypes.js';
import type { AppState, RepeatKind, ScheduleType } from '../types/index.js';

export function ScheduleView({ state, now, onNavigate }: { state: AppState; now: number; onNavigate: (v: string) => void }) {
  const today = todayKey(now);
  const [type, setType] = useState<ScheduleType>('work');
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [repeat, setRepeat] = useState<RepeatKind>('none');
  const [memo, setMemo] = useState('');
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const errors = validateEntry({ date, startTime, endTime });
  const week = useMemo(() => thisWeek(state.schedule, today), [state.schedule, today]);

  const save = () => {
    if (errors.length > 0) return;
    actions.addSchedule({ type, date, startTime, endTime, repeat, memo: memo.trim() });
    setMemo('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <section className="view" aria-label="スケジュール登録">
      <div className="sub-head">
        <span className="title">スケジュール登録</span>
        <button className="btn" onClick={save} disabled={errors.length > 0}>保存</button>
      </div>

      <div className="tabs" role="tablist" aria-label="種類">
        {SCHEDULE_TYPES.map((t) => (
          <button key={t.id} role="tab" aria-selected={type === t.id} className={type === t.id ? 'tab on' : 'tab'} onClick={() => setType(t.id)}>{t.label}</button>
        ))}
      </div>

      <ul className="rows form-rows">
        <li className="row-item"><label>日付<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label></li>
        <li className="row-item"><label>開始時刻<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label></li>
        <li className="row-item"><label>終了時刻<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label></li>
        <li className="row-item">
          <button className="row-btn" onClick={() => setRepeatOpen((v) => !v)} aria-expanded={repeatOpen}>
            <span className="name">繰り返し</span><span className="val">{repeatLabel(repeat)} <Icon name="chevron" size={14} /></span>
          </button>
          {repeatOpen && (
            <ul className="rows nested">
              {REPEAT_KINDS.map((r) => (
                <li key={r.id}>
                  <button className="row-btn" onClick={() => { setRepeat(r.id); setRepeatOpen(false); }}>
                    <span className="name">{r.label}<span className="quiet inline">{r.note}</span></span>
                    {repeat === r.id && <Icon name="check" size={16} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
        <li className="row-item"><label>メモ<input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="未入力" maxLength={500} /></label></li>
      </ul>
      {errors.length > 0 && <p className="quiet">{errors.map((e) => e.message).join('／')}</p>}
      {saved && <p className="quiet">保存しました。カレンダーに反映されます。</p>}

      <h3 className="label">登録済み（今週）</h3>
      {week.length === 0 ? (
        <p className="quiet">今週の予定はありません</p>
      ) : (
        <ul className="rows">
          {week.map(({ date: d, entry }) => (
            <li key={`${d}-${entry.id}`} className="row-item sched">
              <span className="band" />
              <span className="name">
                {shortDate(d)}（{WEEKDAYS[weekdayOf(d)]}） {scheduleTypeLabel(entry.type)}
                {entry.repeat !== 'none' && <span className="quiet inline">{repeatLabel(entry.repeat)}</span>}
                {entry.memo && <span className="quiet inline">{entry.memo}</span>}
              </span>
              <span className="val">{entry.startTime}–{entry.endTime}</span>
              <button className="icon-btn" onClick={() => actions.deleteSchedule(entry.id)} aria-label="この予定を削除"><Icon name="trash" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <p className="quiet">保存した予定は <button className="link" onClick={() => onNavigate('calendar')}>カレンダー</button> にそのまま出ます（別のデータは持ちません）。</p>
    </section>
  );
}
