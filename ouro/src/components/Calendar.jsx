// カレンダー。会社で起きたこと（実績）と、これから起きること（予定）を日付で見る。
//
// 実績は tasks / knowledge / meetings から導き、締切は deals から導く。
// **予定（events）にだけ自分で入れたものを持つ**（締切をここに複製すると二重管理になる）。

import { useMemo, useState } from 'react';
import { Card, Field, Empty, Stat, Row } from './ui.jsx';
import {
  monthMatrix,
  monthMarks,
  monthSummary,
  dayDetail,
  upcoming,
  suggestStart,
  startOfDay,
  ymd,
  WEEKDAYS,
  EVENT_KINDS,
  DAY_MS,
} from '../lib/schedule.js';
import { formatMoney, DEAL_STATUS } from '../lib/revenue.js';
import { usd, relTime } from '../lib/format.js';

export default function Calendar({ store, go, toast }) {
  const today = startOfDay(Date.now());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [form, setForm] = useState(null);

  const data = {
    tasks: store.tasks,
    knowledge: store.knowledge,
    meetings: store.meetings,
    deals: store.deals,
    events: store.events,
  };

  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const marks = useMemo(() => monthMarks(weeks, data), [weeks, store.tasks, store.knowledge, store.meetings, store.deals, store.events]);
  const summary = useMemo(() => monthSummary(cursor.year, cursor.month, data), [cursor, store.tasks, store.knowledge, store.deals]);
  const detail = useMemo(() => dayDetail(selected, data), [selected, store.tasks, store.knowledge, store.meetings, store.deals, store.events]);
  const soon = useMemo(() => upcoming({ events: store.events, deals: store.deals }), [store.events, store.deals]);

  const move = (delta) => {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const goToday = () => {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(today);
  };

  const saveEvent = () => {
    try {
      store.addEvent({ ...form, at: selected });
      setForm(null);
      toast('予定を入れました');
    } catch (e) {
      toast(e.message);
    }
  };

  const selDate = new Date(selected);
  const isToday = selected === today;

  return (
    <div className="screen fade-in">
      {/* 月の切り替え */}
      <div className="cal-nav">
        <button type="button" className="btn ghost" onClick={() => move(-1)} aria-label="前の月">‹</button>
        <div className="cal-title">
          <span className="serif">{cursor.year}年 {cursor.month + 1}月</span>
        </div>
        <button type="button" className="btn ghost" onClick={() => move(1)} aria-label="次の月">›</button>
        <button type="button" className="btn small" onClick={goToday}>今日</button>
      </div>

      {/* 月のマス目 */}
      <div className="cal">
        <div className="cal-week head">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`cal-wd ${i === 0 ? 'sun' : ''} ${i === 6 ? 'sat' : ''}`}>{w}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="cal-week">
            {week.map((cell) => {
              const m = marks.get(cell.ts);
              return (
                <button
                  key={cell.ts}
                  type="button"
                  className={`cal-day${cell.inMonth ? '' : ' out'}${cell.ts === today ? ' today' : ''}${cell.ts === selected ? ' sel' : ''}`}
                  onClick={() => { setSelected(cell.ts); setForm(null); }}
                >
                  <span className={`d ${cell.weekday === 0 ? 'sun' : ''}${cell.weekday === 6 ? 'sat' : ''}`}>
                    {cell.date}
                  </span>
                  <span className="marks">
                    {m?.deadlines ? <i className="mk deadline" title="締切">▲</i> : null}
                    {m?.tasks ? <i className="mk task" title="仕事">●</i> : null}
                    {m?.knowledge ? <i className="mk kn" title="知識">◆</i> : null}
                    {m?.events ? <i className="mk ev" title="予定">■</i> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="cal-legend muted">
        ▲ 締切　● 完了した仕事　◆ 増えた知識　■ 自分の予定
      </div>

      {/* 今月の集計 */}
      <div className="stats" style={{ margin: '12px 0' }}>
        <Stat value={summary.tasks} label="仕事" />
        <Stat value={summary.knowledge} label="知識" />
        <Stat value={formatMoney(summary.earned)} label="入金" />
        <Stat value={usd(summary.cost)} label="AI費用" />
      </div>

      {/* 選んだ日の中身 */}
      <div className="toc-head">
        {selDate.getMonth() + 1}月{selDate.getDate()}日（{WEEKDAYS[selDate.getDay()]}）
        {isToday && <span className="badge solid" style={{ marginLeft: 8 }}>今日</span>}
      </div>

      {detail.deadlines.map((d) => {
        const s = suggestStart(d, Date.now());
        return (
          <Card key={d.id} glyph="▲" title={`締切：${d.title}`}>
            <div className="muted" style={{ marginTop: -6 }}>
              {DEAL_STATUS[d.status]}・{formatMoney(d.fee)}
              {s && (s.overdue ? `・${-s.daysLeft}日超過` : `・あと${s.daysLeft}日`)}
            </div>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button type="button" className="btn small primary" onClick={() => go('deal', d.id)}>
                案件を開く
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => go('compose', { dealId: d.id, request: `案件「${d.title}」を進めます。` })}
              >
                AI社員に作業させる
              </button>
            </div>
          </Card>
        );
      })}

      {detail.events.map((e) => {
        const kind = EVENT_KINDS.find((k) => k.id === e.kind);
        return (
          <div key={e.id} className="card tight">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="rune">{kind?.glyph || '■'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, textDecoration: e.done ? 'line-through' : 'none' }}>{e.title}</div>
                <div className="muted">{kind?.name || '予定'}{e.note ? `・${e.note}` : ''}</div>
              </div>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => store.updateEvent(e.id, { done: !e.done })}
              >
                {e.done ? '戻す' : '済'}
              </button>
              <button type="button" className="btn ghost small" onClick={() => store.removeEvent(e.id)}>
                削除
              </button>
            </div>
          </div>
        );
      })}

      {detail.tasks.map((t) => (
        <Row key={t.id} glyph="●" title={t.title} sub={`完了・${(t.steps || []).length}人が担当`} onClick={() => go('task', t.id)} />
      ))}
      {detail.knowledge.map((k) => (
        <Row key={k.id} glyph="◆" title={k.title} sub={`${k.category}・知識になった`} onClick={() => go('knowledgeDetail', k.id)} />
      ))}
      {detail.meetings.map((m) => (
        <Row key={m.id} glyph="◎" title={m.topic} sub="AI会議" onClick={() => go('meetingDetail', m.id)} />
      ))}

      {detail.total === 0 && (
        <Empty>
          この日はまだ何もありません。
          <div className="muted" style={{ marginTop: 6 }}>{ymd(selected)}</div>
        </Empty>
      )}

      {/* 予定を入れる */}
      {form ? (
        <Card glyph="＋" title="予定を入れる">
          <Field label="内容">
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例：〇〇さんに納品する"
              autoFocus
            />
          </Field>
          <Field label="種類">
            <div className="chips">
              {EVENT_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  className={`chip ${form.kind === k.id ? 'on' : ''}`}
                  onClick={() => setForm({ ...form, kind: k.id })}
                >
                  {k.glyph} {k.name}
                </button>
              ))}
            </div>
          </Field>
          <Field label="メモ（任意）">
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={saveEvent} disabled={!form.title.trim()}>
              入れる
            </button>
            <button type="button" className="btn ghost" onClick={() => setForm(null)}>やめる</button>
          </div>
        </Card>
      ) : (
        <button
          type="button"
          className="btn block"
          onClick={() => setForm({ title: '', kind: 'plan', note: '' })}
          style={{ marginTop: 8 }}
        >
          ＋ この日に予定を入れる
        </button>
      )}

      {/* これから2週間 */}
      <div className="toc-head">これから2週間</div>
      {soon.length ? (
        soon.slice(0, 8).map((x) => (
          <Row
            key={`${x.kind}-${x.id}`}
            glyph={x.kind === 'deadline' ? '▲' : '■'}
            title={x.title}
            sub={`${x.daysLeft === 0 ? '今日' : `あと${x.daysLeft}日`}${x.fee ? `・${formatMoney(x.fee)}` : ''}`}
            onClick={() => (x.kind === 'deadline' ? go('deal', x.id) : setSelected(x.at))}
          />
        ))
      ) : (
        <Empty>
          先の予定はまだありません。
          <div className="muted" style={{ marginTop: 6 }}>
            案件に締切を入れると、ここと月のマスに自動で出ます。
          </div>
        </Empty>
      )}

      {/* 締切から逆算した着手日の提案 */}
      {store.deals.some((d) => d.dueAt && !['paid', 'lost'].includes(d.status)) && (
        <Card glyph="⟳" title="いつ始めるか（締切からの逆算）">
          {store.deals
            .filter((d) => d.dueAt && !['paid', 'lost'].includes(d.status))
            .map((d) => ({ d, s: suggestStart(d, Date.now()) }))
            .sort((a, b) => a.s.daysLeft - b.s.daysLeft)
            .slice(0, 4)
            .map(({ d, s }) => (
              <div key={d.id} className="muted" style={{ padding: '3px 0' }}>
                <strong style={{ color: '#fff' }}>{d.title}</strong>：
                {s.overdue
                  ? `締切を${-s.daysLeft}日過ぎています。今日やるか、締切を引き直してください。`
                  : s.lead === 0
                    ? '今日から手をつけてください。'
                    : `${new Date(s.startAt).getMonth() + 1}/${new Date(s.startAt).getDate()} までに着手（締切まであと${s.daysLeft}日）`}
              </div>
            ))}
        </Card>
      )}
    </div>
  );
}
