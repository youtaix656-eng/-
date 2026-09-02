import { useMemo, useState } from 'react';
import { actions } from '../lib/useStore';
import {
  FULLNESS_OPTIONS, FOOD_GUIDE, PLANS, PLAN_MAP, PRECHECKS, PRECHECK_NOTICE, STOP_SIGNS,
  UNVERIFIED_CLAIMS, fastingHours, nextMealAt, pauseAdvice, stepUpAdvice, targetHoursFor,
} from '../lib/fasting';
import { addDays, diffDays } from '../lib/date';
import { MEAL_SOURCE } from '../data/presets';
import type { AppState } from '../types';

const emptyMeal = { firstMealAt: null, lastMealAt: null, lastMealCrossesMidnight: false, fullness: null, signs: [] as string[] };

/**
 * 食事の時間と量。
 * ⚠ 連続日数は数えない。数えると「切らさないこと」が目的になり、
 *   体からのサインを無視して続ける方向に押してしまうため。
 */
export default function MealCard({ state, date, today }: { state: AppState; date: string; today: string }) {
  const [openPlan, setOpenPlan] = useState(false);
  const [openClaims, setOpenClaims] = useState(false);
  const record = state.days[date];
  const meal = { ...emptyMeal, ...(record?.meal ?? {}) };
  const prev = state.days[addDays(date, -1)]?.meal;

  const target = targetHoursFor(record, state.settings);
  const hours = fastingHours(prev?.lastMealAt, Boolean(prev?.lastMealCrossesMidnight), meal.firstMealAt);
  const next = nextMealAt(meal.lastMealAt, meal.lastMealCrossesMidnight, target);
  const plan = PLAN_MAP[state.settings.fastingPlan] ?? PLANS[0];

  const recent = useMemo(
    () => Array.from({ length: 14 }, (_, i) => state.days[addDays(today, -i)]),
    [state.days, today],
  );
  const advice = useMemo(() => pauseAdvice(recent), [recent]);
  const daysOnPlan = state.settings.fastingPlanSince ? Math.max(0, diffDays(state.settings.fastingPlanSince, today)) : 0;
  const stepUp = stepUpAdvice(plan.id, daysOnPlan, advice);
  const prechecked = state.settings.fastingPrechecks.length > 0;

  const toggleSign = (id: string) =>
    actions.setMeal(date, { signs: meal.signs.includes(id) ? meal.signs.filter((s) => s !== id) : [...meal.signs, id] });

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0, flex: 1 }}>🍚 食事の時間と量</h3>
        <span className="tag">{plan.label}</span>
      </div>

      {/* 止めどきが最優先。いちばん上に出す */}
      {advice.shouldPause && (
        <div className="confirm">
          <h4>いったん普通に食べてください</h4>
          <p className="small" style={{ margin: 0 }}>{advice.text}</p>
          <p className="small muted" style={{ margin: 0 }}>
            直近2週間で出ていたサイン：{advice.signs.map((s) => `${s.label}（${s.count}日）`).join('／')}
          </p>
          {plan.step !== null && plan.step > 0 && (
            <button
              type="button"
              className="btn slim secondary"
              onClick={() => actions.setFastingPlan(PLANS.find((p) => p.step === (plan.step ?? 1) - 1)!.id, today)}
            >
              段階をひとつ戻す
            </button>
          )}
        </div>
      )}

      {prechecked && (
        <p className="note-line" style={{ margin: 0, borderLeftColor: 'var(--ember)' }}>
          始める前の確認で当てはまる項目があります。{PRECHECK_NOTICE}
        </p>
      )}

      <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">最初の食事</span>
          <input type="time" value={meal.firstMealAt ?? ''} onChange={(e) => actions.setMeal(date, { firstMealAt: e.target.value || null })} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">最後の食事</span>
          <input type="time" value={meal.lastMealAt ?? ''} onChange={(e) => actions.setMeal(date, { lastMealAt: e.target.value || null })} />
        </label>
      </div>
      {meal.lastMealAt && (
        <button
          type="button"
          className="chip"
          aria-pressed={meal.lastMealCrossesMidnight}
          onClick={() => actions.setMeal(date, { lastMealCrossesMidnight: !meal.lastMealCrossesMidnight })}
        >
          最後の食事は日付をまたいだ（夜勤明けなど）
        </button>
      )}

      {hours !== null && (
        <p className="note-line warm" style={{ margin: 0 }}>
          前の食事から <strong className="num">{hours}時間</strong> 空きました
          <span className="muted small" style={{ display: 'block' }}>
            目標は{target}時間{record?.shift === 'work' && state.settings.fastingWorkdayHours > 0 ? '（勤務日の設定）' : ''}。
            届かない日があっても問題ありません。
          </span>
        </p>
      )}
      {next && (
        <p className="small muted" style={{ margin: 0 }}>
          この目標なら、次に食べる目安は <span className="num">{next.label}</span> ごろです。
        </p>
      )}

      <div>
        <p className="section-title">食べ終わりの感覚</p>
        <div className="chips">
          {FULLNESS_OPTIONS.map((o) => (
            <button key={o.id} type="button" className="chip" aria-pressed={meal.fullness === o.id}
              onClick={() => actions.setMeal(date, { fullness: meal.fullness === o.id ? null : (o.id as 'eight' | 'full' | 'over') })}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          出典がいちばん強く言っているのは「1食にしてもドカ食いをしない」ことです。回数より、こちらが先。
        </p>
      </div>

      <div>
        <p className="section-title">体からのサイン（あれば）</p>
        <div className="chips">
          {STOP_SIGNS.map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={meal.signs.includes(s.id)} onClick={() => toggleSign(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          記録は自分を責めるためではなく、止めどきに気づくためのものです。
        </p>
      </div>

      <button type="button" className="btn slim ghost" onClick={() => setOpenPlan((v) => !v)}>
        {openPlan ? '段階を閉じる' : `段階を見る（いま：${plan.label}）`}
      </button>

      {openPlan && (
        <div className="stack" style={{ gap: 8 }}>
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="habit"
              aria-pressed={plan.id === p.id}
              onClick={() => actions.setFastingPlan(p.id, today)}
            >
              <span className="box" aria-hidden="true">{plan.id === p.id ? '●' : ''}</span>
              <span className="body">
                {p.label}
                <span className="criterion">{p.summary}{p.caution ? ` ${p.caution}` : ''}</span>
              </span>
            </button>
          ))}
          <p className="note-line" style={{ margin: 0 }}>{stepUp.reason}</p>

          <details className="acc">
            <summary>始める前の確認（{state.settings.fastingPrechecks.length}件 該当）</summary>
            <div className="chips">
              {PRECHECKS.map((c) => {
                const on = state.settings.fastingPrechecks.includes(c.id);
                return (
                  <button key={c.id} type="button" className="chip" aria-pressed={on}
                    onClick={() => actions.setSettings({
                      fastingPrechecks: on
                        ? state.settings.fastingPrechecks.filter((x) => x !== c.id)
                        : [...state.settings.fastingPrechecks, c.id],
                    })}>
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="note-line" style={{ margin: '8px 0 0', borderLeftColor: 'var(--ember)' }}>{PRECHECK_NOTICE}</p>
          </details>

          <p className="small muted" style={{ margin: 0 }}>
            {FOOD_GUIDE.body}
            <span style={{ display: 'block', marginTop: 4 }}>{FOOD_GUIDE.linkNote}</span>
          </p>
        </div>
      )}

      <button type="button" className="btn slim ghost" onClick={() => setOpenClaims((v) => !v)}>
        {openClaims ? '閉じる' : '出典の主張のうち、裏が取れていないもの'}
      </button>
      {openClaims && (
        <div className="stack" style={{ gap: 8 }}>
          {UNVERIFIED_CLAIMS.map((c) => (
            <div key={c.id}>
              <p className="small" style={{ margin: 0 }}>「{c.claim}」</p>
              <p className="note-line" style={{ margin: '4px 0 0', borderLeftColor: 'var(--ember)' }}>{c.note}</p>
            </div>
          ))}
          <p className="small muted" style={{ margin: 0 }}>
            出典：{MEAL_SOURCE.origin}（{MEAL_SOURCE.receivedAt} 受領）。{MEAL_SOURCE.caution}
          </p>
        </div>
      )}
    </div>
  );
}
