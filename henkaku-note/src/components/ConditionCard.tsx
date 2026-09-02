import { useState } from 'react';
import { actions } from '../lib/useStore';
import {
  ANXIETY_ACTIONS, DOMAINS, FERMENTS, FIBERS, FRAMING, INDOOR_NATURE, NATURE_MINUTES_TARGET,
  SLEEP_HYGIENE, SOCIAL_OPTIONS, conditionOf, domainDone,
} from '../lib/condition';
import { CONDITION_SOURCE } from '../data/presets';
import type { AppState } from '../types';

/** 複数選べるチップ列 */
function Multi({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button" className="chip" aria-pressed={selected.includes(o)} onClick={() => onToggle(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

/**
 * 『最高の体調』の記録。
 * ⚠ 炎症スコアは出さない（体内の炎症は検査で測るもので、行動から数値化できない）。
 *   出すのは「その領域の行動を置けたか」だけ。
 */
export default function ConditionCard({ state, date }: { state: AppState; date: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [showFraming, setShowFraming] = useState(false);
  const record = state.days[date];
  const c = conditionOf(record);

  const toggleIn = (key: 'ferments' | 'fibers' | 'indoorNature' | 'anxietyActions' | 'sleepHygiene', value: string) => {
    const list = c[key];
    actions.setCondition(date, { [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0, flex: 1 }}>🔥 最高の体調</h3>
        <button type="button" className="btn slim ghost" onClick={() => setShowFraming((v) => !v)}>
          {showFraming ? '閉じる' : 'なぜ？'}
        </button>
      </div>

      {showFraming && (
        <div className="stack" style={{ gap: 8 }}>
          <p className="section-title">{FRAMING.civilization.title}</p>
          <p className="small" style={{ margin: 0 }}>{FRAMING.civilization.body}</p>
          <p className="section-title">{FRAMING.inflammation.title}</p>
          <p className="small" style={{ margin: 0 }}>{FRAMING.inflammation.body}</p>
          <p className="note-line" style={{ margin: 0 }}>{FRAMING.inflammation.caution}</p>
          <p className="small muted" style={{ margin: 0 }}>
            出典：{CONDITION_SOURCE.origin}（{CONDITION_SOURCE.receivedAt} 受領）。{CONDITION_SOURCE.caution}
          </p>
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        {DOMAINS.filter((d) => d.id !== 'rules').map((d) => {
          const done = domainDone(record, d.id);
          const isOpen = open === d.id;
          return (
            <div key={d.id} className="cond-row">
              <button
                type="button"
                className="habit"
                aria-pressed={done}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : d.id)}
              >
                <span className="box" aria-hidden="true">{done ? '✓' : ''}</span>
                <span className="body">
                  <span className="step">{d.icon}</span>{d.title}
                  <span className="criterion">{isOpen ? d.why : (d.linkedTo ?? 'タップして記録する')}</span>
                </span>
              </button>

              {isOpen && (
                <div className="cond-body">
                  {d.id === 'gut' && (
                    <>
                      <p className="section-title">発酵食品（種類を増やす）</p>
                      <Multi options={FERMENTS} selected={c.ferments} onToggle={(v) => toggleIn('ferments', v)} />
                      <p className="section-title">食物繊維</p>
                      <Multi options={FIBERS} selected={c.fibers} onToggle={(v) => toggleIn('fibers', v)} />
                    </>
                  )}

                  {d.id === 'nature' && (
                    <>
                      <label className="field">
                        <span className="field-label">外で自然に触れた時間（目安 {NATURE_MINUTES_TARGET}分・2日に1回）</span>
                        <input
                          type="number"
                          min={0}
                          max={600}
                          value={c.natureMinutes || ''}
                          placeholder="0"
                          onChange={(e) => actions.setCondition(date, { natureMinutes: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </label>
                      <p className="section-title">室内に取り入れた自然</p>
                      <Multi options={INDOOR_NATURE} selected={c.indoorNature} onToggle={(v) => toggleIn('indoorNature', v)} />
                      <p className="small muted" style={{ margin: 0 }}>本物でなくても効果を実感できるとされます（写真・壁紙・川や鳥の音）。</p>
                    </>
                  )}

                  {d.id === 'sleep' && (
                    <>
                      <div className="chips">
                        {SLEEP_HYGIENE.map((h) => (
                          <button key={h.id} type="button" className="chip" aria-pressed={c.sleepHygiene.includes(h.id)} onClick={() => toggleIn('sleepHygiene', h.id)}>
                            {h.label}
                          </button>
                        ))}
                      </div>
                      <p className="small muted" style={{ margin: 0 }}>眠った時間・寝つきの記録は、下の「就寝ルール」にまとめてあります。</p>
                    </>
                  )}

                  {d.id === 'social' && (
                    <>
                      <div className="chips">
                        {SOCIAL_OPTIONS.map((o) => (
                          <button key={o.id} type="button" className="chip" aria-pressed={c.social === o.id} onClick={() => actions.setCondition(date, { social: c.social === o.id ? null : o.id })}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                      <p className="small muted" style={{ margin: 0 }}>
                        相手の名前は記録しません（誰かを記録する機能にしないため）。
                        {c.social === 'none' && ' 話さなかった日があること自体は、責めるものではありません。'}
                      </p>
                    </>
                  )}

                  {d.id === 'anxiety' && (
                    <>
                      <div className="chips">
                        <button type="button" className="chip" aria-pressed={c.anxietyFelt === true} onClick={() => actions.setCondition(date, { anxietyFelt: c.anxietyFelt === true ? null : true })}>
                          ぼんやりした不安があった
                        </button>
                        <button type="button" className="chip" aria-pressed={c.anxietyFelt === false} onClick={() => actions.setCondition(date, { anxietyFelt: c.anxietyFelt === false ? null : false })}>
                          特に感じなかった
                        </button>
                      </div>
                      {c.anxietyFelt === true && (
                        <>
                          <p className="section-title">やってみた対処</p>
                          <div className="chips">
                            {ANXIETY_ACTIONS.map((a) => (
                              <button key={a.id} type="button" className="chip" aria-pressed={c.anxietyActions.includes(a.id)} onClick={() => toggleIn('anxietyActions', a.id)}>
                                {a.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
