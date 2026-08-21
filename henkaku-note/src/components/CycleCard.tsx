import { useMemo, useState } from 'react';
import { actions } from '../lib/useStore';
import {
  currentCycle, cycleProgress, makeCycle, shouldPromptClosing, streak, totalPracticedDays, DEFAULT_CYCLE_DAYS,
} from '../lib/cycle';
import { formatDateJa } from '../lib/date';
import type { AppState } from '../types';

/**
 * 実践期間（区切り）とストリーク。
 *
 * ⚠ 主役は「◯日目 / 全◯日」。連続日数は補助にとどめる。
 *   ゴーストモードは「最低1ヶ月」で、無期限の実践は想定されていない。
 *   連続日数を煽ると、1日抜けただけで台無しに感じて離脱しやすいため。
 */
export default function CycleCard({ state, today }: { state: AppState; today: string }) {
  const [starting, setStarting] = useState(false);
  const [goal, setGoal] = useState('');
  const [days, setDays] = useState(DEFAULT_CYCLE_DAYS);
  const [closingNote, setClosingNote] = useState('');

  const cycle = currentCycle(state.cycles);
  const progress = useMemo(
    () => (cycle ? cycleProgress(cycle, state.days, state.habits, today) : null),
    [cycle, state.days, state.habits, today],
  );
  const s = useMemo(() => streak(state.days, state.habits, today), [state.days, state.habits, today]);
  const total = useMemo(() => totalPracticedDays(state.days, state.habits), [state.days, state.habits]);
  const prompt = shouldPromptClosing(progress);

  if (!cycle) {
    return (
      <div className="card">
        <h3>🌅 実践期間をはじめる</h3>
        <p className="small muted" style={{ margin: 0 }}>
          ゴーストモードは<strong>まず1ヶ月</strong>を区切りにします。無期限で走り続ける前提ではありません
          （燃え尽きを避けるための区切りです）。期間の終わりに、続けるかどうかを自分で決めます。
        </p>
        {!starting ? (
          <button type="button" className="btn" onClick={() => setStarting(true)}>期間をはじめる</button>
        ) : (
          <>
            <label className="field">
              <span className="field-label">この期間の最上位目標（1つだけ）</span>
              <input type="text" maxLength={80} value={goal} placeholder="例：鍼灸国試の過去問を5年分やりきる" onChange={(e) => setGoal(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">日数</span>
              <div className="chips">
                {[30, 60, 90].map((d) => (
                  <button key={d} type="button" className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>{d}日</button>
                ))}
              </div>
            </label>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button type="button" className="btn slim secondary" onClick={() => setStarting(false)}>やめる</button>
              <button
                type="button"
                className="btn slim"
                disabled={!goal.trim()}
                onClick={() => { actions.startCycle(makeCycle(today, goal, Date.now(), days)); setStarting(false); }}
              >
                today からはじめる
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const p = progress!;
  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0, flex: 1 }}>🌅 {p.dayNumber}日目 <span className="muted small">/ 全{p.lengthDays}日</span></h3>
        <span className="tag">{formatDateJa(p.endDate)}まで</span>
      </div>
      <div className="rate-bar" aria-hidden="true"><span style={{ width: `${(p.dayNumber / p.lengthDays) * 100}%` }} /></div>
      <p className="note-line warm" style={{ margin: 0 }}>{cycle.goal || '（目標が未設定です）'}</p>

      <p className="small muted" style={{ margin: 0 }}>
        この期間に実践した日 <span className="num">{p.practicedDays}</span>日／通算 <span className="num">{total}</span>日
        {state.settings.showStreakProminently
          ? `　連続 ${s.current}日（最長 ${s.longest}日）`
          : s.current >= 3 && `　いまつながって ${s.current}日`}
      </p>
      {s.brokenYesterday && (
        <p className="small muted" style={{ margin: 0 }}>
          きのうは記録がありませんでした。連続は途切れますが、通算 {total}日は消えません。今日からまた1日目です。
        </p>
      )}

      {prompt && (
        <div className="confirm">
          <h4>期間の終わりです</h4>
          <p className="small" style={{ margin: 0 }}>
            {p.lengthDays}日ぶんを走りきりました（実践できた日 {p.practicedDays}日）。
            ここで<strong>続けるかどうかを決めてください</strong>。やめるのも、区切りとして正しい選択です。
          </p>
          <label className="field">
            <span className="field-label">この期間で分かったこと（任意）</span>
            <textarea rows={3} maxLength={400} value={closingNote} onChange={(e) => setClosingNote(e.target.value)} />
          </label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <button type="button" className="btn slim secondary" onClick={() => actions.closeCycle(cycle.id, 'finish', closingNote)}>ここで終える</button>
            <button type="button" className="btn slim secondary" onClick={() => actions.closeCycle(cycle.id, 'pause', closingNote)}>一度休む</button>
            <button
              type="button"
              className="btn slim"
              onClick={() => {
                actions.closeCycle(cycle.id, 'continue', closingNote);
                actions.startCycle(makeCycle(today, cycle.goal, Date.now(), cycle.lengthDays));
                setClosingNote('');
              }}
            >
              もう1期間続ける
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
