import { useMemo, useState } from 'react';

// カレンダー：勉強や試験などの予定を入力・管理する。
// 予定は store.schedule = [{ id, date, time, title, memo, kind }] に保存。

const KINDS = [
  { id: 'study', label: '勉強', ico: '📖' },
  { id: 'exam', label: '試験', ico: '📝' },
  { id: 'todo', label: '予定', ico: '📌' },
  { id: 'deadline', label: '締切', ico: '⏰' },
];
const kindOf = (id) => KINDS.find((k) => k.id === id) || KINDS[2];

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => ymd(new Date());

function newId() {
  return `ev-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

// 月のグリッド（前月末〜翌月頭で6週ぶんを埋める）
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export default function Calendar({ store, onToast }) {
  const { schedule, setSchedule } = store;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState(todayKey());
  const [editing, setEditing] = useState(null); // 編集中イベント or 新規テンプレ

  const byDate = useMemo(() => {
    const m = {};
    for (const ev of schedule) (m[ev.date] ||= []).push(ev);
    for (const k in m) m[k].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return m;
  }, [schedule]);

  // 次の「試験」予定までのカウントダウン
  const nextExam = useMemo(() => {
    const t = todayKey();
    return schedule
      .filter((e) => e.kind === 'exam' && e.date >= t)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [schedule]);

  const upcoming = useMemo(() => {
    const t = todayKey();
    return schedule
      .filter((e) => e.date >= t)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
      .slice(0, 8);
  }, [schedule]);

  const daysUntil = (dateStr) => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const target = new Date(y, mo - 1, d);
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Math.round((target - base) / 86400000);
  };

  const cells = monthGrid(year, month);
  const prevMonth = () => {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const nextMonth = () => {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(todayKey());
  };

  const startNew = () => setEditing({ id: null, date: selected, time: '', title: '', memo: '', kind: 'study' });
  const startEdit = (ev) => setEditing({ ...ev });

  const saveEvent = () => {
    if (!editing.title.trim()) {
      onToast('予定の名前を入力してください');
      return;
    }
    if (editing.id) {
      setSchedule(schedule.map((e) => (e.id === editing.id ? { ...editing } : e)));
    } else {
      setSchedule([...schedule, { ...editing, id: newId() }]);
    }
    setSelected(editing.date);
    setEditing(null);
    onToast('予定を保存しました');
  };
  const deleteEvent = (id) => {
    setSchedule(schedule.filter((e) => e.id !== id));
    setEditing(null);
    onToast('予定を削除しました');
  };

  const selectedEvents = byDate[selected] || [];

  return (
    <div className="view">
      <h2 className="view-title">カレンダー</h2>
      <p className="view-desc">勉強や試験の予定を書き込めます。日付をタップして予定を追加。</p>

      {nextExam && (
        <div className="exam-countdown">
          <span className="cd-ico">📝</span>
          <div>
            <div className="cd-title">{nextExam.title}</div>
            <div className="cd-sub">{nextExam.date}</div>
          </div>
          <div className="cd-days">
            あと<strong>{Math.max(0, daysUntil(nextExam.date))}</strong>日
          </div>
        </div>
      )}

      <div className="cal-head">
        <button className="btn ghost sm" onClick={prevMonth} aria-label="前の月">‹</button>
        <div className="cal-title">{year}年 {month + 1}月</div>
        <button className="btn ghost sm" onClick={nextMonth} aria-label="次の月">›</button>
        <button className="btn ghost sm" onClick={goToday}>今日</button>
      </div>

      <div className="cal-grid">
        {WD.map((w, i) => (
          <div key={w} className={`cal-wd ${i === 0 ? 'sun' : ''} ${i === 6 ? 'sat' : ''}`}>{w}</div>
        ))}
        {cells.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === month;
          const evs = byDate[key] || [];
          const isToday = key === todayKey();
          const isSel = key === selected;
          return (
            <button
              key={key}
              className={`cal-cell ${inMonth ? '' : 'dim'} ${isToday ? 'today' : ''} ${isSel ? 'sel' : ''}`}
              onClick={() => setSelected(key)}
            >
              <span className={`cal-date ${d.getDay() === 0 ? 'sun' : ''} ${d.getDay() === 6 ? 'sat' : ''}`}>
                {d.getDate()}
              </span>
              {evs.length > 0 && (
                <span className="cal-dots">
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className={`cal-dot k-${e.kind}`} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="cal-selected">
        <div className="cal-sel-head">
          <strong>{selected}（{WD[new Date(selected.replace(/-/g, '/')).getDay()]}）</strong>
          <button className="btn primary sm" onClick={startNew}>＋ 予定を追加</button>
        </div>
        {selectedEvents.length === 0 ? (
          <p className="inline-note">この日の予定はまだありません。</p>
        ) : (
          selectedEvents.map((ev) => (
            <button key={ev.id} className="event-row" onClick={() => startEdit(ev)}>
              <span className={`event-kind k-${ev.kind}`}>{kindOf(ev.kind).ico}</span>
              <span className="event-main">
                <span className="event-title">{ev.title}</span>
                {(ev.time || ev.memo) && (
                  <span className="event-sub">
                    {ev.time && <span className="event-time">{ev.time}</span>}
                    {ev.memo && <span className="event-memo">{ev.memo}</span>}
                  </span>
                )}
              </span>
              <span className="event-chev">›</span>
            </button>
          ))
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="section-label" style={{ marginTop: 0 }}>これからの予定</div>
          {upcoming.map((ev) => (
            <button key={ev.id} className="event-row compact" onClick={() => { setSelected(ev.date); startEdit(ev); }}>
              <span className={`event-kind k-${ev.kind}`}>{kindOf(ev.kind).ico}</span>
              <span className="event-main">
                <span className="event-title">{ev.title}</span>
                <span className="event-sub">
                  <span className="event-time">{ev.date}{ev.time ? ` ${ev.time}` : ''}</span>
                </span>
              </span>
              <span className="event-count">{daysUntil(ev.date) === 0 ? '今日' : `あと${daysUntil(ev.date)}日`}</span>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{editing.id ? '予定を編集' : '予定を追加'}</h3>
            <label className="field">
              <span>種類</span>
              <div className="kind-picker">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    className={`kind-chip k-${k.id} ${editing.kind === k.id ? 'on' : ''}`}
                    onClick={() => setEditing({ ...editing, kind: k.id })}
                  >
                    {k.ico} {k.label}
                  </button>
                ))}
              </div>
            </label>
            <label className="field">
              <span>予定名</span>
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="例）解剖学の復習 / 模試 / 願書提出"
                autoFocus
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>日付</span>
                <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
              </label>
              <label className="field">
                <span>時刻（任意）</span>
                <input type="time" value={editing.time} onChange={(e) => setEditing({ ...editing, time: e.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>メモ（任意）</span>
              <textarea
                value={editing.memo}
                onChange={(e) => setEditing({ ...editing, memo: e.target.value })}
                placeholder="持ち物・範囲・場所など"
                style={{ minHeight: 60 }}
              />
            </label>
            <div className="btn-row">
              {editing.id && (
                <button className="btn danger" onClick={() => deleteEvent(editing.id)}>削除</button>
              )}
              <button className="btn" onClick={() => setEditing(null)}>キャンセル</button>
              <button className="btn primary" onClick={saveEvent}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
