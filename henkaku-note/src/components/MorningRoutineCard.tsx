import { useEffect, useMemo, useRef, useState } from 'react';
import { actions } from '../lib/useStore';
import {
  PRESETS, ROUTINE_STEPS, ROUTINE_UNVERIFIED, WAKE_FIRST_NOTE, WATER_ON_WAKING_NOTE,
  activeSteps, checkAffirmation, didRoutine, minutesFromWake, normalizeAffirmations,
  planMinutes, routineOf, startedQuickly, totalMinutes, ZERO_MORNING_LIMIT,
} from '../lib/morningRoutine';
import { formatRemaining } from '../lib/meditation';
import { getThree, ITEM_MAX } from '../lib/threeRules';
import { monkOf } from '../lib/monkMode';
import { ROUTINE_SOURCE } from '../data/presets';
import type { AppState } from '../types';

/**
 * 起きて最初のルーティン（6ステップ）。
 * ⚠ 「朝」を前提にしない。夜勤明けで起きるのが昼でも、それがその人の「起きて最初」。
 * ⚠ 終わったステップは**既存の記録へ書き込む**（瞑想・運動・読書・今日の3つ）。
 */
export default function MorningRoutineCard({ state, date, today }: { state: AppState; date: string; today: string }) {
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [showPlan, setShowPlan] = useState(false);
  const [showClaims, setShowClaims] = useState(false);

  const record = state.days[date];
  const r = routineOf(record);
  const steps = useMemo(() => activeSteps(state.settings), [state.settings]);
  const minutes = useMemo(() => planMinutes(state.settings), [state.settings]);
  const total = totalMinutes(state.settings);
  const affirmations = normalizeAffirmations(state.settings.affirmations);
  const three = getThree(state.threeRules, 'day', date);
  const fromWake = minutesFromWake(record);
  const quick = startedQuickly(record);
  const isToday = date === today;

  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // 残りは実時間で計算する（画面を閉じてもズレない）
  useEffect(() => {
    if (deadline === null) return undefined;
    const tick = () => {
      const left = (deadline - Date.now()) / 1000;
      setRemaining(left > 0 ? left : 0);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

  const nowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  /** ステップを終えて、既存の記録へ書き込む */
  const finishStep = (stepIndex: number) => {
    const step = stepsRef.current[stepIndex];
    if (!step) return;
    const m = minutes[step.id] ?? 0;
    actions.completeRoutineStep(date, step.id);
    if (step.writesTo === 'meditation' && m > 0) actions.addMeditation(date, m);
    if (step.writesTo === 'workout' && m > 0) {
      const cur = monkOf(record);
      actions.setMonk(date, { workoutMinutes: cur.workoutMinutes + m, workoutAt: cur.workoutAt ?? nowHHMM() });
    }
    if (step.writesTo === 'reading' && m > 0) {
      actions.setMonk(date, { readingMinutes: monkOf(record).readingMinutes + m });
    }
  };

  const start = () => {
    actions.setRoutine(date, { startedAt: r.startedAt ?? nowHHMM() });
    setIndex(0);
    setRunning(true);
    setDeadline(Date.now() + (minutes[steps[0]?.id] ?? 1) * 60_000);
  };

  const next = () => {
    finishStep(index);
    const nextIndex = index + 1;
    if (nextIndex >= steps.length) {
      setRunning(false);
      setDeadline(null);
      return;
    }
    setIndex(nextIndex);
    setDeadline(Date.now() + (minutes[steps[nextIndex].id] ?? 1) * 60_000);
  };

  // ── 実行中 ──
  if (running && steps[index]) {
    const step = steps[index];
    return (
      <div className="card">
        <div className="row">
          <span className="tag dawn">{index + 1} / {steps.length}</span>
          <div className="spacer" />
          <span className="num muted">{formatRemaining(remaining)}</span>
        </div>
        <h3 style={{ margin: 0 }}>{step.icon} {step.title}</h3>
        <p className="small" style={{ margin: 0 }}>{step.how}</p>

        {step.id === 'affirmation' && (
          <div className="stack" style={{ gap: 6 }}>
            {affirmations.filter((a) => a.trim()).length === 0 ? (
              <p className="note-line" style={{ margin: 0 }}>
                目標がまだ登録されていません。下の「内容を決める」から、数字と期限を入れて書いておいてください。
              </p>
            ) : (
              affirmations.filter((a) => a.trim()).map((a) => (
                <p className="note-line warm" key={a} style={{ margin: 0 }}>{a}</p>
              ))
            )}
          </div>
        )}

        {step.id === 'journal' && (
          <div className="stack" style={{ gap: 8 }}>
            <p className="section-title">今日終わらせること</p>
            {three.map((t, i) => (
              <input key={i} type="text" maxLength={ITEM_MAX} value={t} placeholder={i === 0 ? '例：過去問を20問' : ''}
                onChange={(e) => actions.setThreeRule('day', date, i, e.target.value)} />
            ))}
          </div>
        )}

        <button type="button" className="btn" onClick={next}>
          {index + 1 >= steps.length ? '終える' : `次へ（${steps[index + 1].title}）`}
        </button>
        <button type="button" className="btn ghost" onClick={() => { setRunning(false); setDeadline(null); }}>
          中断する（ここまでは記録されます）
        </button>
      </div>
    );
  }

  // ── ふだんの表示 ──
  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0, flex: 1 }}>🌅 起きて最初の{total}分</h3>
        <span className="tag">{r.doneSteps.length} / {steps.length}</span>
      </div>

      <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">起きた時刻</span>
          <input type="time" value={r.wakeAt ?? ''} onChange={(e) => actions.setRoutine(date, { wakeAt: e.target.value || null })} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">始めた時刻</span>
          <input type="time" value={r.startedAt ?? ''} onChange={(e) => actions.setRoutine(date, { startedAt: e.target.value || null })} />
        </label>
      </div>
      {fromWake !== null && (
        <p className="small" style={{ margin: 0 }}>
          起きてから <span className="num">{fromWake}分</span>で始めています
          {quick === true ? '（ゼロ・モーニングルーティンの目安 20分以内）' : `（目安は${ZERO_MORNING_LIMIT}分以内。時刻を早めるより、起きてすぐ始める形を作るほうが効きます）`}
        </p>
      )}

      <button type="button" className="chip" aria-pressed={r.waterOnWaking}
        onClick={() => actions.setRoutine(date, { waterOnWaking: !r.waterOnWaking })}>
        起きてすぐ水を1杯飲んだ
      </button>
      <p className="small muted" style={{ margin: 0 }}>{WATER_ON_WAKING_NOTE}</p>

      {r.doneSteps.length > 0 && (
        <div className="chips">
          {steps.map((s) => (
            <span key={s.id} className={`tag${r.doneSteps.includes(s.id) ? ' dawn' : ''}`}>
              {s.icon} {s.title}
            </span>
          ))}
        </div>
      )}

      {isToday ? (
        <button type="button" className="btn" onClick={start}>
          {didRoutine(record) ? 'もう一度はじめる' : `はじめる（${steps.length}ステップ・${total}分）`}
        </button>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>実行できるのは今日だけです。過去の日は記録の確認と手直しができます。</p>
      )}

      <p className="note-line" style={{ margin: 0 }}>{WAKE_FIRST_NOTE}</p>

      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn slim ghost" onClick={() => setShowPlan((v) => !v)}>
          {showPlan ? '閉じる' : '内容を決める'}
        </button>
        <button type="button" className="btn slim ghost" onClick={() => setShowClaims((v) => !v)}>
          {showClaims ? '閉じる' : '断定していないもの'}
        </button>
      </div>

      {showPlan && (
        <div className="stack" style={{ gap: 8 }}>
          <div>
            <p className="section-title">長さ</p>
            <div className="chips">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className="chip" aria-pressed={state.settings.routinePreset === p.id}
                  onClick={() => actions.setSettings({ routinePreset: p.id })}>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              {PRESETS.find((p) => p.id === state.settings.routinePreset)?.note}
            </p>
          </div>

          {state.settings.routinePreset === 'custom' && (
            <div className="stack" style={{ gap: 6 }}>
              {allStepsInOrder(state).map((s) => (
                <div className="row" key={s.id} style={{ flexWrap: 'nowrap', gap: 8 }}>
                  <span className="small" style={{ flex: 1, minWidth: 0 }}>{s.icon} {s.title}</span>
                  <input type="number" min={0} max={120} style={{ maxWidth: 90 }}
                    value={state.settings.routineCustomMinutes[s.id] ?? s.fullMinutes}
                    onChange={(e) => actions.setSettings({
                      routineCustomMinutes: { ...state.settings.routineCustomMinutes, [s.id]: Math.max(0, Number(e.target.value) || 0) },
                    })} />
                  <span className="small muted">分</span>
                </div>
              ))}
              <p className="small muted" style={{ margin: 0 }}>0分にすると、そのステップは実行から外れます。</p>
            </div>
          )}

          <div>
            <p className="section-title">アファメーション（数字と期限を入れる）</p>
            {affirmations.map((a, i) => {
              const check = checkAffirmation(a);
              return (
                <div key={i} className="field">
                  <input type="text" maxLength={80} value={a} placeholder={i === 0 ? '例：2027年3月までに国家試験に合格する' : ''}
                    onChange={(e) => actions.setAffirmation(i, e.target.value)} />
                  {a.trim() && !check.ok && <p className="small muted" style={{ margin: '4px 0 0' }}>{check.hint}</p>}
                </div>
              );
            })}
          </div>

          <label className="field">
            <span className="field-label">起床の目標時刻（就寝前の言い換えに使います）</span>
            <input type="time" value={state.settings.wakeTargetAt ?? ''}
              onChange={(e) => actions.setSettings({ wakeTargetAt: e.target.value || null })} />
          </label>
        </div>
      )}

      {showClaims && (
        <div className="stack" style={{ gap: 8 }}>
          {ROUTINE_UNVERIFIED.map((c) => (
            <div key={c.id}>
              <p className="small" style={{ margin: 0 }}>「{c.claim}」</p>
              <p className="note-line" style={{ margin: '4px 0 0', borderLeftColor: c.hard ? 'var(--ember)' : 'var(--indigo)' }}>{c.note}</p>
            </div>
          ))}
          <p className="small muted" style={{ margin: 0 }}>
            出典：{ROUTINE_SOURCE.origin}（{ROUTINE_SOURCE.receivedAt} 受領）。{ROUTINE_SOURCE.caution}
          </p>
        </div>
      )}
    </div>
  );
}

/** custom の設定では、0分にしたステップも一覧に出す（戻せるようにするため activeSteps は使わない） */
function allStepsInOrder(state: AppState) {
  const { routineOrder } = state.settings;
  if (!routineOrder || routineOrder.length === 0) return ROUTINE_STEPS;
  const known = routineOrder.map((id) => ROUTINE_STEPS.find((s) => s.id === id)).filter(Boolean) as typeof ROUTINE_STEPS;
  return [...known, ...ROUTINE_STEPS.filter((s) => !routineOrder.includes(s.id))];
}
