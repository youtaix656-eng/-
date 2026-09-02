import { useMemo, useState } from 'react';
import { actions } from '../lib/useStore';
import { formatDateJa } from '../lib/date';
import { activeHabits, completionRate, habitsForDate, sortHabits } from '../lib/habits';
import { bedtimeTarget, guessCrossesMidnight, judgeBedtime } from '../lib/shift';
import { suggestionsFor } from '../lib/audioLink';
import { MEDITATION_HABIT_ID } from '../data/presets';
import MeditationCard from './MeditationCard';
import ConditionCard from './ConditionCard';
import MealCard from './MealCard';
import MonkModeCard from './MonkModeCard';
import ThreeRules from './ThreeRules';
import { getThree } from '../lib/threeRules';
import { SLEEP_CRITERIA, durationVerdict, judgeSleepQuality, emptySleepQuality } from '../lib/sleepQuality';
import type { AppState } from '../types';

interface Props {
  state: AppState;
  date: string;
  today: string;
  onOpenWeekly: () => void;
}

const DECLARATION_MAX = 60;
const NOTE_MAX = 600;

/** 就寝の記録（ステップ⑤）。目標は設定とシフトから毎回導出し、保存はしない */
function BedtimeCard({ state, date }: { state: AppState; date: string }) {
  const record = state.days[date];
  const target = bedtimeTarget(record, state.settings);
  const verdict = judgeBedtime(record, state.settings);
  const [time, setTime] = useState(record?.sleep?.actualAt ?? '');

  const shift = record?.shift ?? null;

  return (
    <div className="card">
      <h3>🌙 就寝ルール</h3>

      <div>
        <p className="section-title">この日は</p>
        <div className="chips">
          <button type="button" className="chip" aria-pressed={shift === 'work'} onClick={() => actions.setShift(date, shift === 'work' ? null : 'work')}>
            勤務日
          </button>
          <button type="button" className="chip" aria-pressed={shift === 'off'} onClick={() => actions.setShift(date, shift === 'off' ? null : 'off')}>
            休日
          </button>
        </div>
      </div>

      {shift === 'work' && (
        <label className="field">
          <span className="field-label">この日の終業時刻（既定 {state.settings.shiftEndDefault}）</span>
          <input
            type="time"
            value={record?.shiftEndsAt ?? state.settings.shiftEndDefault}
            onChange={(e) => actions.setShiftEndsAt(date, e.target.value || null)}
          />
        </label>
      )}

      {target ? (
        <>
          <p className="note-line warm" style={{ margin: 0 }}>
            就寝目標：<strong className="num">{target.label}</strong>
            <span className="muted small" style={{ display: 'block' }}>{target.reason}</span>
          </p>
          <label className="field">
            <span className="field-label">実際に寝た時刻</span>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              <button
                type="button"
                className="btn slim"
                disabled={!time}
                onClick={() =>
                  actions.setSleep(date, {
                    actualAt: time,
                    crossesMidnight: guessCrossesMidnight(time, target),
                    recordedAt: Date.now(),
                  })
                }
              >
                記録
              </button>
            </div>
          </label>
          {record?.sleep && (
            <div className="row">
              <span className={`tag ${verdict.verdict === 'met' ? 'dawn' : 'ember'}`}>
                {verdict.verdict === 'met' ? '目標内' : '目標より後'}
              </span>
              <span className="small">{verdict.text}</span>
              <button
                type="button"
                className="chip"
                aria-pressed={record.sleep.crossesMidnight}
                onClick={() => actions.setSleep(date, { ...record.sleep!, crossesMidnight: !record.sleep!.crossesMidnight })}
              >
                日付をまたいだ
              </button>
              <button type="button" className="btn slim ghost" onClick={() => { actions.setSleep(date, null); setTime(''); }}>
                消す
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>
          勤務日か休日かを選ぶと、その日の就寝目標が出ます。
          （原典の「夜11時就寝」は夜勤と両立しないため、終業時刻を基準に計算しています）
        </p>
      )}

      <SleepQualityBlock state={state} date={date} />
    </div>
  );
}

/**
 * 眠りの質（『最高の体調』の「良質な睡眠の最低条件」）。
 * 就寝目標＝いつ寝たか、こちら＝どう眠れたか。層が違うのでロジックは分けたまま、画面は同じカードにまとめる。
 * 記録していない項目は「分からない」のままにして、睡眠不足だと決めつけない。
 */
function SleepQualityBlock({ state, date }: { state: AppState; date: string }) {
  const [open, setOpen] = useState(false);
  const q = { ...emptySleepQuality(), ...(state.days[date]?.sleepQuality ?? {}) };
  const result = judgeSleepQuality(q);
  const duration = durationVerdict(q);
  const num = (v: number | null) => (v === null ? '' : String(v));

  return (
    <div className="stack" style={{ gap: 8 }}>
      <hr className="divider" />
      <button type="button" className="btn slim ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? '眠りの質を閉じる' : '眠りの質を記録する'}
        {result.allMet !== null && (
          <span className={`tag ${result.allMet ? 'dawn' : 'ember'}`} style={{ marginLeft: 8 }}>
            {result.allMet ? '4条件すべて' : `${result.unmet.length}件 未達`}
          </span>
        )}
      </button>

      {open && (
        <>
          <p className="small muted" style={{ margin: 0 }}>
            本書の「良質な睡眠の最低条件」です。分かるものだけで構いません（空欄は判定しません）。
          </p>
          <label className="field">
            <span className="field-label">眠りに落ちるまで（分）</span>
            <input type="number" min={0} max={600} value={num(q.fallAsleepMinutes)}
              onChange={(e) => actions.setSleepQuality(date, { fallAsleepMinutes: e.target.value === '' ? null : Number(e.target.value) })} />
          </label>
          <label className="field">
            <span className="field-label">夜中に目が覚めた回数</span>
            <input type="number" min={0} max={20} value={num(q.awakenings)}
              onChange={(e) => actions.setSleepQuality(date, { awakenings: e.target.value === '' ? null : Number(e.target.value) })} />
          </label>
          {(q.awakenings ?? 0) > 0 && (
            <div className="chips">
              <button type="button" className="chip" aria-pressed={q.backToSleepWithin20 === true}
                onClick={() => actions.setSleepQuality(date, { backToSleepWithin20: q.backToSleepWithin20 === true ? null : true })}>
                20分以内に再び眠れた
              </button>
              <button type="button" className="chip" aria-pressed={q.backToSleepWithin20 === false}
                onClick={() => actions.setSleepQuality(date, { backToSleepWithin20: q.backToSleepWithin20 === false ? null : false })}>
                20分以上かかった
              </button>
            </div>
          )}
          <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">寝床にいた時間（分）</span>
              <input type="number" min={0} max={1440} value={num(q.inBedMinutes)}
                onChange={(e) => actions.setSleepQuality(date, { inBedMinutes: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">眠っていた時間（分）</span>
              <input type="number" min={0} max={1440} value={num(q.sleptMinutes)}
                onChange={(e) => actions.setSleepQuality(date, { sleptMinutes: e.target.value === '' ? null : Number(e.target.value) })} />
            </label>
          </div>

          {duration.verdict !== 'unknown' && <p className="small" style={{ margin: 0 }}>{duration.text}</p>}
          {result.efficiency !== null && <p className="small muted" style={{ margin: 0 }}>睡眠効率 {result.efficiency}%</p>}

          <div className="stack" style={{ gap: 4 }}>
            {SLEEP_CRITERIA.map((cri) => {
              const state2 = result.met.includes(cri) ? 'met' : result.unmet.includes(cri) ? 'unmet' : 'unknown';
              return (
                <p key={cri.id} className="small" style={{ margin: 0, color: state2 === 'unknown' ? 'var(--mist)' : undefined }}>
                  {state2 === 'met' ? '✓' : state2 === 'unmet' ? '·' : '–'} {cri.label}
                  {state2 === 'unmet' && <span className="muted" style={{ display: 'block', paddingLeft: 14 }}>{cri.hint}</span>}
                </p>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** 選んだ1日を書く画面。宣言 → 習慣 → 就寝 → メモ の順に並べる */
export default function DayPanel({ state, date, today, onOpenWeekly }: Props) {
  const record = state.days[date];
  const habits = useMemo(() => sortHabits(habitsForDate(state.habits, date).filter((h) => h.archivedAt === null)), [state.habits, date]);
  const rate = completionRate(record, state.habits);
  const done = new Set(record?.checked ?? []);
  const suggestions = useMemo(
    () => suggestionsFor(record?.checked ?? [], state.habits, state.settings),
    [record?.checked, state.habits, state.settings],
  );
  const isFuture = date > today;

  return (
    <div className="stack">
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>{formatDateJa(date)}</h2>
          <div className="spacer" />
          <span className="num muted">{Math.round(rate * 100)}%</span>
        </div>
        <div className="rate-bar" aria-hidden="true"><span style={{ width: `${Math.round(rate * 100)}%` }} /></div>
        {isFuture && <p className="small muted" style={{ margin: 0 }}>先の日付です。予定（勤務日・休日）だけ先に入れておけます。</p>}

        {/* 古い「今日の宣言」は、書いてあるものだけ読めるように残す（3のルールに置き換えた） */}
        {record?.declaration ? (
          <label className="field">
            <span className="field-label">今日の宣言（{DECLARATION_MAX}文字まで）</span>
            <input
              type="text"
              maxLength={DECLARATION_MAX}
              value={record.declaration}
              onChange={(e) => actions.setDeclaration(date, e.target.value)}
            />
          </label>
        ) : null}
      </div>

      <ThreeRules
        state={state}
        scope="day"
        date={date}
        title="今日の3つ"
        lead="毎朝3つ書き出して、目の前に置いておく。1つだけでも構いません。"
        upper={getThree(state.threeRules, 'week', date)}
        upperLabel="今週の3つ"
      />

      <div className="card">
        <h3>今日の習慣</h3>
        {habits.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>この日に有効な習慣がありません。「習慣」画面で追加できます。</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {habits.map((h) => (
              <button
                key={h.id}
                type="button"
                className="habit"
                aria-pressed={done.has(h.id)}
                onClick={() => actions.toggleHabit(date, h.id)}
              >
                <span className="box" aria-hidden="true">{done.has(h.id) ? '✓' : ''}</span>
                <span className="body">
                  {h.step !== null && <span className="step">{'①②③④⑤⑥⑦'[h.step - 1]}</span>}
                  {h.title}
                  <span className="criterion">{h.criterion}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {activeHabits(state.habits).some((h) => h.id === 'step7-weekly') && (
          <button type="button" className="btn slim secondary" onClick={onOpenWeekly}>
            週次振り返りを書く（⑦）
          </button>
        )}
      </div>

      <ConditionCard state={state} date={date} />

      <MealCard state={state} date={date} today={today} />

      <MonkModeCard state={state} date={date} today={today} />

      {suggestions.length > 0 && (
        <div className="card">
          <h3>🔊 ついでに一歩</h3>
          {suggestions.map((s) => (
            <p className="note-line" key={s.habitId} style={{ margin: 0 }}>
              {s.reason}
              <a className="btn slim secondary" href={s.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, textDecoration: 'none' }}>
                {s.label} ↗
              </a>
            </p>
          ))}
        </div>
      )}

      {state.habits.some((h) => h.id === MEDITATION_HABIT_ID && h.archivedAt === null) && (
        <MeditationCard state={state} date={date} canRunTimer={date === today} />
      )}

      <BedtimeCard state={state} date={date} />

      <div className="card paper">
        <h3>学び・振り返り</h3>
        <textarea
          maxLength={NOTE_MAX}
          rows={6}
          value={record?.note ?? ''}
          placeholder="うまくいったこと、詰まったこと、気づいたこと"
          onChange={(e) => actions.setNote(date, e.target.value)}
        />
        <p className="small muted" style={{ margin: 0 }}>{(record?.note ?? '').length} / {NOTE_MAX}</p>
      </div>
    </div>
  );
}
