import { useMemo, useState } from 'react';
import { actions } from '../lib/useStore';
import {
  activeHabits, makeCustomHabit, sortHabits, validateHabit, HABIT_TITLE_MAX, HABIT_CRITERION_MAX,
} from '../lib/habits';
import { hasAudioLink } from '../lib/audioLink';
import { HABIT_PRESETS, MEDITATION_SOURCE, presetToHabit } from '../data/presets';
import type { AppState, Habit } from '../types';

interface Props {
  state: AppState;
}

const STEP_MARKS = '①②③④⑤⑥⑦';

function HabitRow({ habit, state }: { habit: Habit; state: AppState }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(habit);
  const check = useMemo(() => validateHabit(draft, state.habits), [draft, state.habits]);

  if (!editing) {
    return (
      <div className="card" style={{ gap: 8 }}>
        <div className="row">
          {habit.step !== null && <span className="tag dawn">{STEP_MARKS[habit.step - 1]}</span>}
          <h4 style={{ flex: 1 }}>{habit.title}</h4>
          {hasAudioLink(habit.id) && <span className="tag">🔊</span>}
          {habit.archivedAt !== null && <span className="tag ember">休止中</span>}
        </div>
        {habit.reading && <p className="small muted" style={{ margin: 0 }}>{habit.reading}</p>}
        <p className="small" style={{ margin: 0 }}>{habit.criterion}</p>
        {habit.note && <p className="note-line" style={{ margin: 0 }}>{habit.note}</p>}
        <div className="row">
          <button type="button" className="btn slim ghost" onClick={() => { setDraft(habit); setEditing(true); }}>編集</button>
          {habit.archivedAt === null ? (
            <button type="button" className="btn slim ghost" onClick={() => actions.archiveHabit(habit.id)}>休止する</button>
          ) : (
            <>
              <button type="button" className="btn slim ghost" onClick={() => actions.restoreHabit(habit.id)}>戻す</button>
              <button type="button" className="btn slim danger" onClick={() => actions.deleteHabit(habit.id)}>完全に削除</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ gap: 8 }}>
      <label className="field">
        <span className="field-label">名前（{HABIT_TITLE_MAX}文字まで）</span>
        <input type="text" maxLength={HABIT_TITLE_MAX} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </label>
      <label className="field">
        <span className="field-label">読み（ひらがな・漢字を含むなら必須）</span>
        <input type="text" maxLength={HABIT_TITLE_MAX} value={draft.reading} onChange={(e) => setDraft({ ...draft, reading: e.target.value })} />
      </label>
      <label className="field">
        <span className="field-label">達成の判断基準（{HABIT_CRITERION_MAX}文字まで）</span>
        <textarea rows={2} maxLength={HABIT_CRITERION_MAX} value={draft.criterion} onChange={(e) => setDraft({ ...draft, criterion: e.target.value })} />
      </label>
      {!check.ok && <p className="note-line" style={{ margin: 0, borderLeftColor: 'var(--ember)' }}>{check.errors[0]}</p>}
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <button type="button" className="btn slim secondary" onClick={() => setEditing(false)}>やめる</button>
        <button
          type="button"
          className="btn slim"
          disabled={!check.ok}
          onClick={() => {
            actions.updateHabit(habit.id, { title: draft.title.trim(), reading: draft.reading.trim(), criterion: draft.criterion.trim() });
            setEditing(false);
          }}
        >
          保存
        </button>
      </div>
    </div>
  );
}

/** 習慣の一覧と編集。7ステップは初期値であって、固定ではない */
export default function HabitsView({ state }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', reading: '', criterion: '' });
  const [confirmReset, setConfirmReset] = useState(false);

  const live = useMemo(() => sortHabits(activeHabits(state.habits)), [state.habits]);
  const archived = useMemo(() => sortHabits(state.habits.filter((h) => h.archivedAt !== null)), [state.habits]);
  const check = useMemo(() => validateHabit({ id: 'new', ...draft }, state.habits), [draft, state.habits]);

  return (
    <div className="stack">
      <div className="card">
        <h2>習慣</h2>
        <p className="small muted" style={{ margin: 0 }}>
          初期値は「ゴーストモード」の7ステップです。あなたの生活に合わせて、書き換えても増やしても構いません。
          <strong>ステップ⑤だけは原典の「夜11時就寝」ではなく、シフト対応版</strong>にしてあります
          （終業が深夜0時前後の日に守れない目標を並べても、続かないためです）。
        </p>
        <button type="button" className="btn" onClick={() => setAdding((v) => !v)}>
          {adding ? '追加をやめる' : '＋ 習慣を追加する'}
        </button>
      </div>

      <div className="card">
        <h3>学んだことから足す</h3>
        <p className="small muted" style={{ margin: 0 }}>
          取り込んだ内容を、そのまま習慣にできます。効果の断定はせず、注意点も一緒に持ちます。
        </p>
        {HABIT_PRESETS.map((p) => {
          const existing = state.habits.find((h) => h.id === p.id);
          const active = existing && existing.archivedAt === null;
          return (
            <div key={p.id} className="card" style={{ gap: 6, background: 'rgba(16,20,43,0.55)' }}>
              <div className="row">
                <h4 style={{ flex: 1 }}>{p.title}</h4>
                {active && <span className="tag dawn">追加ずみ</span>}
              </div>
              <p className="small" style={{ margin: 0 }}>{p.criterion}</p>
              <p className="note-line" style={{ margin: 0 }}>{p.note}</p>
              {!active && (
                <button type="button" className="btn slim secondary" onClick={() => actions.addPresetHabit(presetToHabit(p, Date.now()))}>
                  習慣に追加する
                </button>
              )}
            </div>
          );
        })}
        <p className="small muted" style={{ margin: 0 }}>
          出典：{MEDITATION_SOURCE.origin}（{MEDITATION_SOURCE.receivedAt} 受領）。{MEDITATION_SOURCE.caution}
        </p>
      </div>

      {adding && (
        <div className="card">
          <h3>新しい習慣</h3>
          <label className="field">
            <span className="field-label">名前（{HABIT_TITLE_MAX}文字まで）</span>
            <input type="text" maxLength={HABIT_TITLE_MAX} value={draft.title} placeholder="例：ストレッチ" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">読み（ひらがな・漢字を含むなら必須）</span>
            <input type="text" maxLength={HABIT_TITLE_MAX} value={draft.reading} onChange={(e) => setDraft({ ...draft, reading: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">何をもって達成とするか</span>
            <textarea rows={2} maxLength={HABIT_CRITERION_MAX} value={draft.criterion} placeholder="迷わないよう、1文で書く" onChange={(e) => setDraft({ ...draft, criterion: e.target.value })} />
          </label>
          {!check.ok && <p className="note-line" style={{ margin: 0, borderLeftColor: 'var(--ember)' }}>{check.errors[0]}</p>}
          <button
            type="button"
            className="btn"
            disabled={!check.ok}
            onClick={() => {
              actions.addHabit(makeCustomHabit(draft, Date.now(), Math.floor(performance.now())));
              setDraft({ title: '', reading: '', criterion: '' });
              setAdding(false);
            }}
          >
            追加する
          </button>
        </div>
      )}

      {live.map((h) => <HabitRow key={h.id} habit={h} state={state} />)}

      {archived.length > 0 && (
        <>
          <p className="section-title">休止中（{archived.length}）</p>
          <p className="small muted" style={{ margin: 0 }}>
            休止しても過去の記録は残ります。すぐ消さずに休止にしておくと、その日の達成率が変わりません。
          </p>
          {archived.map((h) => <HabitRow key={h.id} habit={h} state={state} />)}
        </>
      )}

      <div className="card">
        {!confirmReset ? (
          <button type="button" className="btn slim ghost" onClick={() => setConfirmReset(true)}>7ステップの初期値に戻す</button>
        ) : (
          <div className="confirm">
            <p className="small" style={{ margin: 0 }}>
              習慣の一覧を初期値（7ステップ）に戻します。追加した習慣の定義は消えますが、
              過去の日次記録そのものは残ります。
            </p>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button type="button" className="btn slim secondary" onClick={() => setConfirmReset(false)}>いいえ</button>
              <button type="button" className="btn slim danger" onClick={() => { actions.resetHabitsToDefault(); setConfirmReset(false); }}>戻す</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
