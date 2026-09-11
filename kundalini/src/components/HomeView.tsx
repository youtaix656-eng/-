import { useMemo, useState } from 'react';
import { actions } from '../lib/useStore.js';
import { CHAKRAS, CHAKRA_DISCLAIMER } from '../data/chakras.js';
import { TRIGGERS } from '../data/triggers.js';
import { HELP_NOTE } from '../data/safety.js';
import { chakraFor, levelFor, nextLevel, normalizeThresholds } from '../lib/level.js';
import { currentDays, dayOrdinal, elapsedMs, hasStarted, longestDays, totalDays } from '../lib/streak.js';
import { justReached, nextBadge } from '../lib/badges.js';
import { formatElapsed, formatDateTime, todayKey, addDaysKey, fromKey } from '../lib/date.js';
import { CalendarGrid } from './CalendarGrid.js';
import type { AppState, DateKey } from '../types/index.js';

// ホーム＝「いま何日目か」と「いまどの段か」だけを大きく出す。
// ⚠ 日数を煽らない：最長記録の隣に**通算日数**を必ず並べる
//    （戻った日に「全部消えた」と見えないようにするため）。

export function HomeView({ state, now, onNavigate }: { state: AppState; now: number; onNavigate: (v: string) => void }) {
  const [showRelapse, setShowRelapse] = useState(false);
  const [month, setMonth] = useState<DateKey>(() => `${todayKey(now).slice(0, 7)}-01`);
  const [picked, setPicked] = useState<DateKey | null>(null);

  const thresholds = normalizeThresholds(state.settings.levelThresholds);
  const days = currentDays(state.startedAt, now);
  const level = levelFor(days, thresholds);
  const chakra = chakraFor(days, thresholds);
  const next = nextLevel(days, thresholds);
  const longest = longestDays(state, now);
  const total = totalDays(state, now);
  const reached = useMemo(() => justReached(days), [days]);
  const nb = nextBadge(days);

  if (!hasStarted(state)) {
    return (
      <div>
        <h2 className="view-title">はじめる</h2>
        <div className="card">
          <p>数え始める日を決めます。あとからいつでも直せます。</p>
          <div className="btn-row">
            <button className="primary" onClick={() => actions.start(Date.now())}>今から数え始める</button>
            <button onClick={() => actions.start(fromKey(todayKey(now)).getTime())}>今日の0時から数える</button>
          </div>
        </div>
        <div className="note">{CHAKRA_DISCLAIMER}</div>
        <div className="note warn">{HELP_NOTE}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="counter" style={{ color: chakra.color }}>
        <div className="days" style={{ color: 'var(--text)' }}>
          {days}
          <span className="unit">日</span>
        </div>
        <div className="elapsed">
          {dayOrdinal(state.startedAt, now)}日目・{formatElapsed(elapsedMs(state.startedAt, now))}
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="v">{longest}</div>
          <div className="k">最長記録（日）</div>
        </div>
        <div className="stat">
          <div className="v">{total}</div>
          <div className="k">通算（日）</div>
        </div>
        <div className="stat">
          <div className="v">{state.relapses.length}</div>
          <div className="k">リラプス記録</div>
        </div>
      </div>
      <p className="small">通算はリセットされません。戻っても、積み上げたぶんは残ります。</p>

      {reached && (
        <div className="card celebrate" style={{ borderColor: chakra.color }}>
          <h3>🎖 {reached.title} に届きました</h3>
          <p className="small">{reached.word}</p>
          <button className="ghost" onClick={() => onNavigate('badges')}>実績を見る</button>
        </div>
      )}

      <div className="card">
        <div className="chakra-head" style={{ color: chakra.color }}>
          <div className="chakra-dot">{level}</div>
          <div>
            <div className="chakra-name" style={{ color: 'var(--text)' }}>
              レベル{level}・{chakra.name}
            </div>
            <div className="chakra-part">{chakra.part}／{chakra.theme}</div>
          </div>
        </div>
        <p className="small" style={{ marginTop: 10 }}>{chakra.note}</p>
        {next ? (
          <>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.round(next.progress * 100)}%`, background: chakra.color }} />
            </div>
            <p className="small">
              次はレベル{next.chakra.level}・{next.chakra.name}（あと{next.daysLeft}日・目安）
            </p>
          </>
        ) : (
          <p className="small">いちばん上の段です。ここから先の区切りはありません。</p>
        )}
        <ul className="ladder">
          {CHAKRAS.map((c, i) => (
            <li key={c.level} className={c.level === level ? 'current' : ''} style={{ color: c.color }}>
              <span className="lv">{c.level}</span>
              <span className={`mark${days >= thresholds[i] ? ' on' : ''}`} />
              <span className="nm" style={{ color: 'var(--text)' }}>
                {c.name}（{c.part}）
              </span>
              <span className="th">{thresholds[i]}日〜</span>
            </li>
          ))}
        </ul>
        <div className="note">{CHAKRA_DISCLAIMER}</div>
        <p className="small">境界の日数はこのアプリが置いた目安です。設定から変えられます。</p>
      </div>

      {nb && (
        <p className="small">次のマイルストーンは {nb.title}（あと{Math.max(0, nb.days - days)}日）。</p>
      )}

      <div className="card">
        <div className="cal-head">
          <button className="ghost" onClick={() => setMonth(monthShift(month, -1))} aria-label="前の月">←</button>
          <strong>{month.slice(0, 4)}年{Number(month.slice(5, 7))}月</strong>
          <button className="ghost" onClick={() => setMonth(monthShift(month, 1))} aria-label="次の月">→</button>
        </div>
        <CalendarGrid state={state} month={month} now={now} onPick={setPicked} selected={picked} />
        {picked && <PickedDay state={state} date={picked} onNavigate={onNavigate} />}
      </div>

      <div className="card">
        <h3>開始日時</h3>
        <p className="small">{state.startedAt ? formatDateTime(state.startedAt) : '未設定'}</p>
        <StartEditor startedAt={state.startedAt} />
      </div>

      <div className="card">
        <h3>戻ってしまったとき</h3>
        <p className="small">
          記録すると、いまの日数は0に戻り、ここまでのぶんは記録として残ります。責めるための記録ではありません。
        </p>
        {showRelapse ? (
          <RelapseForm onDone={() => setShowRelapse(false)} />
        ) : (
          <button className="danger wide" onClick={() => setShowRelapse(true)}>リラプスを記録する</button>
        )}
      </div>

      <div className="note warn">{HELP_NOTE}</div>
    </div>
  );
}

function monthShift(month: DateKey, delta: number): DateKey {
  const d = fromKey(month);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function PickedDay({ state, date, onNavigate }: { state: AppState; date: DateKey; onNavigate: (v: string) => void }) {
  const rec = state.days[date];
  const relapses = state.relapses.filter((r) => new Date(r.at).toDateString() === fromKey(date).toDateString());
  return (
    <div className="card flat" style={{ marginBottom: 0 }}>
      <h3>{date}</h3>
      {relapses.map((r) => (
        <p key={r.id} className="small">
          リラプスの記録：{formatDateTime(r.at)}
          {r.triggers.length > 0 && `／${r.triggers.map((t) => TRIGGERS.find((x) => x.id === t)?.label ?? t).join('・')}`}
        </p>
      ))}
      {rec ? (
        <>
          <p className="small">
            体調 {rec.body ?? '—'}／集中 {rec.focus ?? '—'}／気分 {rec.mood ?? '—'}
          </p>
          {rec.journal && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{rec.journal}</p>}
        </>
      ) : (
        <p className="small">この日の記録はありません。</p>
      )}
      <button className="ghost" onClick={() => onNavigate('record')}>記録の画面をひらく</button>
    </div>
  );
}

function StartEditor({ startedAt }: { startedAt: number | null }) {
  const base = startedAt ?? Date.now();
  const d = new Date(base);
  const [date, setDate] = useState(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  );
  const [time, setTime] = useState(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  const [msg, setMsg] = useState('');
  return (
    <div>
      <label htmlFor="start-date">開始日</label>
      <input id="start-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <label htmlFor="start-time">開始時刻</label>
      <input id="start-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button
          onClick={() => {
            const [y, m, dd] = date.split('-').map(Number);
            const [hh, mm] = time.split(':').map(Number);
            if (!y || !m || !dd) {
              setMsg('日付が読めませんでした。');
              return;
            }
            const at = new Date(y, m - 1, dd, hh || 0, mm || 0).getTime();
            if (at > Date.now()) {
              setMsg('これから先の日時は設定できません。');
              return;
            }
            actions.setStartedAt(at);
            setMsg('開始日時を直しました。');
          }}
        >
          この日時にする
        </button>
        <button className="ghost" onClick={() => actions.setStartedAt(fromKey(addDaysKey(todayKey(), 0)).getTime())}>
          今日の0時にする
        </button>
      </div>
      {msg && <p className="small ok-msg">{msg}</p>}
    </div>
  );
}

export function RelapseForm({ onDone }: { onDone: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const cares = TRIGGERS.filter((t) => picked.includes(t.id));
  return (
    <div>
      <label>きっかけ（複数えらべます・分からなければ空のままでもかまいません）</label>
      <div className="chip-row">
        {TRIGGERS.map((t) => (
          <button key={t.id} className={`chip${picked.includes(t.id) ? ' on' : ''}`} onClick={() => toggle(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {cares.length > 0 && (
        <div className="card flat">
          <h3>次に同じ場面が来たら</h3>
          {cares.map((t) => (
            <p key={t.id} className="small">・{t.care}</p>
          ))}
          <p className="small">※ どれも「こうすれば起きない」という保証ではなく、試してみる案です。</p>
        </div>
      )}
      <label htmlFor="relapse-note">メモ（任意）</label>
      <textarea
        id="relapse-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="そのとき何をしていたか。人の名前や連絡先は書かないでください。"
      />
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button
          className="danger"
          onClick={() => {
            actions.recordRelapse({ triggers: picked, note });
            onDone();
          }}
        >
          記録して0日から数え直す
        </button>
        <button className="ghost" onClick={onDone}>やめる</button>
      </div>
    </div>
  );
}
