import { useMemo, useState } from 'react';
import { actions } from '../lib/useStore';
import {
  CONFLICTS, MONK_AREAS, MONK_DAYS, MONK_PERIOD_NOTE, MONK_PRECHECKS, MONK_PRECHECK_NOTICE,
  MONK_UNVERIFIED, SNS_RULES, SNS_RULE_MAP, areaDone, bodyReminder, goldenWindow, isolationWarning,
  monkOf, weeklyMonk,
} from '../lib/monkMode';
import { weekDays } from '../lib/date';
import { MONK_SOURCE } from '../data/presets';
import type { AppState } from '../types';

/**
 * モンクモード。
 * ⚠ 既存と重なるもの（瞑想・加工食品・人との接点）はここに作らず、既存の記録へ寄せる。
 *   「友人と距離を置く」は実装せず、「一人で集中した時間」だけを記録する（CONFLICTS を参照）。
 */
export default function MonkModeCard({ state, date, today }: { state: AppState; date: string; today: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [showConflict, setShowConflict] = useState(false);
  const [showClaims, setShowClaims] = useState(false);

  const record = state.days[date];
  const m = monkOf(record);
  const golden = goldenWindow(record);
  const week = useMemo(() => weekDays(today), [today]);
  const weekly = useMemo(() => weeklyMonk(state.days, week, state.settings), [state.days, week, state.settings]);
  const reminder = bodyReminder(weekly, state.settings);
  const isolation = useMemo(() => isolationWarning(state.days, week), [state.days, week]);
  const rule = state.settings.monkSnsRule ? SNS_RULE_MAP[state.settings.monkSnsRule] : null;
  const prechecked = state.settings.monkPrechecks.length > 0;

  const set = (patch: Parameters<typeof actions.setMonk>[1]) => actions.setMonk(date, patch);

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0, flex: 1 }}>🧘‍♂️ モンクモード</h3>
        <span className="tag">累計{MONK_DAYS}日</span>
      </div>

      {isolation && <p className="note-line" style={{ margin: 0, borderLeftColor: 'var(--ember)' }}>{isolation}</p>}
      {prechecked && <p className="note-line" style={{ margin: 0, borderLeftColor: 'var(--ember)' }}>{MONK_PRECHECK_NOTICE}</p>}
      {reminder && <p className="note-line warm" style={{ margin: 0 }}>{reminder}</p>}
      {golden && <p className="note-line warm" style={{ margin: 0 }}>{golden.text}</p>}

      <div className="stack" style={{ gap: 8 }}>
        {MONK_AREAS.map((a) => {
          const done = areaDone(record, a.id, state.settings);
          const isOpen = open === a.id;
          return (
            <div key={a.id} className="cond-row">
              <button type="button" className="habit" aria-pressed={done} aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : a.id)}>
                <span className="box" aria-hidden="true">{done ? '✓' : ''}</span>
                <span className="body">
                  <span className="step">{a.icon}</span>{a.title}
                  <span className="criterion">{isOpen ? a.why : 'タップして記録する'}</span>
                </span>
              </button>

              {isOpen && a.id === 'mind' && (
                <div className="cond-body">
                  <p className="section-title">SNSの制限（決めたやり方を守れたか）</p>
                  <div className="chips">
                    {SNS_RULES.map((r) => (
                      <button key={r.id} type="button" className="chip" aria-pressed={state.settings.monkSnsRule === r.id}
                        onClick={() => actions.setSettings({ monkSnsRule: state.settings.monkSnsRule === r.id ? null : r.id })}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {rule && (
                    <>
                      <p className="small muted" style={{ margin: 0 }}>{rule.detail}</p>
                      <div className="chips">
                        <button type="button" className="chip" aria-pressed={m.snsRuleKept === true}
                          onClick={() => set({ snsRuleKept: m.snsRuleKept === true ? null : true })}>今日は守れた</button>
                        <button type="button" className="chip" aria-pressed={m.snsRuleKept === false}
                          onClick={() => set({ snsRuleKept: m.snsRuleKept === false ? null : false })}>守れなかった</button>
                      </div>
                    </>
                  )}

                  <label className="field">
                    <span className="field-label">読書（分）</span>
                    <input type="number" min={0} max={600} value={m.readingMinutes || ''} placeholder="0"
                      onChange={(e) => set({ readingMinutes: Math.max(0, Number(e.target.value) || 0) })} />
                  </label>
                  <label className="field">
                    <span className="field-label">一人で集中した時間（分）</span>
                    <input type="number" min={0} max={1440} value={m.soloMinutes || ''} placeholder="0"
                      onChange={(e) => set({ soloMinutes: Math.max(0, Number(e.target.value) || 0) })} />
                  </label>
                  <p className="small muted" style={{ margin: 0 }}>
                    出典は「友人と距離を置く」と言っていますが、このアプリが記録するのは
                    <strong>一人で集中した時間</strong>だけです。人との接点は🤝人間関係にそのまま残してください。
                  </p>
                </div>
              )}

              {isOpen && a.id === 'body' && (
                <div className="cond-body">
                  <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                    <label className="field" style={{ flex: 1 }}>
                      <span className="field-label">水（mL・目安 {state.settings.monkWaterMl}）</span>
                      <input type="number" min={0} max={6000} step={100} value={m.waterMl || ''} placeholder="0"
                        onChange={(e) => set({ waterMl: Math.max(0, Number(e.target.value) || 0) })} />
                    </label>
                    <label className="field" style={{ flex: 1 }}>
                      <span className="field-label">歩数（目安 {state.settings.monkSteps}）</span>
                      <input type="number" min={0} max={100000} step={100} value={m.steps || ''} placeholder="0"
                        onChange={(e) => set({ steps: Math.max(0, Number(e.target.value) || 0) })} />
                    </label>
                  </div>
                  <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                    <label className="field" style={{ flex: 1 }}>
                      <span className="field-label">運動（分）</span>
                      <input type="number" min={0} max={600} value={m.workoutMinutes || ''} placeholder="0"
                        onChange={(e) => set({ workoutMinutes: Math.max(0, Number(e.target.value) || 0) })} />
                    </label>
                    <label className="field" style={{ flex: 1 }}>
                      <span className="field-label">運動した時刻</span>
                      <input type="time" value={m.workoutAt ?? ''} onChange={(e) => set({ workoutAt: e.target.value || null })} />
                    </label>
                  </div>
                  <p className="small muted" style={{ margin: 0 }}>
                    今週の運動 {weekly.workouts}回／目安 週{state.settings.monkWorkoutPerWeek}回
                    {weekly.averageSteps !== null && `　歩数の平均 ${weekly.averageSteps.toLocaleString()}歩`}
                  </p>
                  <p className="note-line" style={{ margin: 0 }}>
                    電解質（塩）については、出典の量をそのまま真似しないでください。
                    血圧・腎臓に不安がある場合は特にです。詳しくは下の「裏が取れていないもの」を見てください。
                  </p>
                </div>
              )}

              {isOpen && a.id === 'spirit' && (
                <div className="cond-body">
                  <p className="small" style={{ margin: 0 }}>
                    やることは1日10分の瞑想です。<strong>このアプリでは🧘瞑想のカードで記録してください</strong>
                    （同じことを2か所に書かせないため）。記録すると、ここにもチェックが入ります。
                  </p>
                  <p className="small muted" style={{ margin: 0 }}>
                    出典は「1〜2週間では効果を実感できないが、3週目から変わってくる」と言っています。
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="small muted" style={{ margin: 0 }}>{MONK_PERIOD_NOTE}</p>

      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn slim ghost" onClick={() => setShowConflict((v) => !v)}>
          {showConflict ? '閉じる' : '⚠ 別の出典と食い違う点'}
        </button>
        <button type="button" className="btn slim ghost" onClick={() => setShowClaims((v) => !v)}>
          {showClaims ? '閉じる' : '裏が取れていないもの'}
        </button>
      </div>

      {showConflict && (
        <div className="stack" style={{ gap: 8 }}>
          {CONFLICTS.map((c) => (
            <div key={c.id} className="confirm">
              <h4>{c.topic}</h4>
              <p className="small" style={{ margin: 0 }}><strong>{c.a.source}</strong>：{c.a.says}</p>
              <p className="small" style={{ margin: 0 }}><strong>{c.b.source}</strong>：{c.b.says}</p>
              <p className="small muted" style={{ margin: 0 }}>{c.handling}</p>
            </div>
          ))}
        </div>
      )}

      {showClaims && (
        <div className="stack" style={{ gap: 8 }}>
          {MONK_UNVERIFIED.map((c) => (
            <div key={c.id}>
              <p className="small" style={{ margin: 0 }}>「{c.claim}」</p>
              <p className="note-line" style={{ margin: '4px 0 0', borderLeftColor: c.hard ? 'var(--ember)' : 'var(--indigo)' }}>{c.note}</p>
            </div>
          ))}
          <details className="acc">
            <summary>塩・運動の前に確認すること（{state.settings.monkPrechecks.length}件 該当）</summary>
            <div className="chips">
              {MONK_PRECHECKS.map((c) => {
                const on = state.settings.monkPrechecks.includes(c.id);
                return (
                  <button key={c.id} type="button" className="chip" aria-pressed={on}
                    onClick={() => actions.setSettings({
                      monkPrechecks: on
                        ? state.settings.monkPrechecks.filter((x) => x !== c.id)
                        : [...state.settings.monkPrechecks, c.id],
                    })}>
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="note-line" style={{ margin: '8px 0 0', borderLeftColor: 'var(--ember)' }}>{MONK_PRECHECK_NOTICE}</p>
          </details>
          <p className="small muted" style={{ margin: 0 }}>
            出典：{MONK_SOURCE.origin}（{MONK_SOURCE.receivedAt} 受領）。{MONK_SOURCE.caution}
          </p>
        </div>
      )}
    </div>
  );
}
