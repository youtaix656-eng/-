import { useMemo, useState } from 'react';
import { actions } from '../lib/useStore';
import { addDays, formatWeekRangeJa, startOfWeek } from '../lib/date';
import {
  buildWeekSummary, compareWeeks, emptyReview, isReviewWritten, isWeekReviewable, managerHint,
  MANAGER_ALLOCATION_OPTIONS, MANAGER_PLAN_OPTIONS, DOER_FEEL_OPTIONS, REVIEW_TEXT_MAX,
} from '../lib/weekly';
import ThreeRules from './ThreeRules';
import { splitFocusText, writtenDays } from '../lib/threeRules';
import { weeklyCondition, weakestDomain } from '../lib/condition';
import { summarizeSleepQuality } from '../lib/sleepQuality';
import { summarizeMeals, pauseAdvice } from '../lib/fasting';
import { weeklyMonk, bodyReminder, isolationWarning } from '../lib/monkMode';
import type { AppState } from '../types';

interface Props {
  state: AppState;
  anchor: string;
  today: string;
  onSelectDay: (date: string) => void;
}

/**
 * 週次振り返り（ステップ⑦）＋ 3分の2バッファ法の2視点。
 *
 * 画面の順番に意味がある:
 *   1. 事実（その週に何があったか）
 *   2. 管理者視点（計画を直す）  ← 先に計画を見る
 *   3. 実行者視点（やってみた感触）
 *   4. 3項目の振り返り
 * 先に「感触」を聞くと、うまくいかなかった週に自己否定から入ってしまうため、
 * 必ず「計画のほう」から見る並びにしている。
 */
export default function WeeklyReviewView({ state, anchor, today, onSelectDay }: Props) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(anchor));
  const summary = useMemo(() => buildWeekSummary(weekStart, state.days, state.habits, state.settings), [weekStart, state]);
  const prev = useMemo(
    () => buildWeekSummary(addDays(weekStart, -7), state.days, state.habits, state.settings),
    [weekStart, state],
  );
  const review = state.weeks[weekStart] ?? emptyReview(weekStart, 0);
  const comparison = compareWeeks(summary, prev);
  const hint = managerHint(summary, state.weeks[weekStart]);
  const threeDone = useMemo(() => writtenDays(state.threeRules, summary.days), [state.threeRules, summary.days]);
  const condition = useMemo(
    () => weeklyCondition(state.days, summary.days, threeDone),
    [state.days, summary.days, threeDone],
  );
  const weakest = useMemo(() => weakestDomain(condition), [condition]);
  const meals = useMemo(
    () => summarizeMeals(summary.days.map((d) => state.days[d]), state.settings),
    [state.days, summary.days, state.settings],
  );
  const mealPause = useMemo(
    () => pauseAdvice(summary.days.map((d) => state.days[d])),
    [state.days, summary.days],
  );
  const monk = useMemo(() => weeklyMonk(state.days, summary.days, state.settings), [state.days, summary.days, state.settings]);
  const monkReminder = useMemo(() => bodyReminder(monk, state.settings), [monk, state.settings]);
  const monkIsolation = useMemo(() => isolationWarning(state.days, summary.days), [state.days, summary.days]);
  const sleepQuality = useMemo(
    () => summarizeSleepQuality(summary.days.map((d) => state.days[d]?.sleepQuality)),
    [state.days, summary.days],
  );
  const reviewable = isWeekReviewable(weekStart, today);
  const written = isReviewWritten(state.weeks[weekStart]);

  const patch = (p: Parameters<typeof actions.updateReview>[1]) => actions.updateReview(weekStart, p);

  return (
    <div className="stack">
      <div className="card">
        <div className="cal-head">
          <button type="button" className="icon-btn" aria-label="前の週" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
          <span className="cal-title">{formatWeekRangeJa(weekStart)}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label="次の週"
            disabled={addDays(weekStart, 7) > today}
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            ›
          </button>
        </div>
        <div className="row">
          {written && <span className="tag dawn">記入ずみ</span>}
          {!reviewable && <span className="tag">まだ週の途中</span>}
          <span className="small muted">記録した日 {summary.recordedDays}／7</span>
        </div>
      </div>

      <ThreeRules
        state={state}
        scope="week"
        date={weekStart}
        title="今週の3つ"
        lead="週の頭に3つ。先週の「来週集中すべきこと」から降ろせます。"
        upper={splitFocusText(state.weeks[addDays(weekStart, -7)]?.focus ?? '')}
        upperLabel="先週の振り返り"
      />

      {/* 1. 事実 */}
      <div className="card">
        <h3>この週にあったこと</h3>
        <div className="row">
          <span className="num" style={{ fontSize: '1.6rem', color: 'var(--dawn)' }}>{Math.round(summary.averageRate * 100)}</span>
          <span className="small muted">% ／ 記録した日の平均達成率</span>
        </div>
        <div className="rate-bar" aria-hidden="true"><span style={{ width: `${Math.round(summary.averageRate * 100)}%` }} /></div>
        {comparison && <p className="small muted" style={{ margin: 0 }}>{comparison.text}</p>}

        {(monk.workouts > 0 || monk.readingMinutes > 0 || monk.snsKeptDays > 0) && (
          <p className="small" style={{ margin: 0 }}>
            モンクモード：運動 {monk.workouts}回／目安 週{state.settings.monkWorkoutPerWeek}回
            {monk.averageSteps !== null && `　歩数の平均 ${monk.averageSteps.toLocaleString()}歩`}
            {monk.readingMinutes > 0 && `　読書 ${monk.readingMinutes}分`}
            {monk.snsKeptDays > 0 && `　SNSの約束を守れた日 ${monk.snsKeptDays}日`}
          </p>
        )}
        {monkReminder && <p className="note-line warm" style={{ margin: 0 }}>{monkReminder}</p>}
        {monkIsolation && <p className="note-line" style={{ margin: 0, borderLeftColor: 'var(--ember)' }}>{monkIsolation}</p>}
        {meals.recorded > 0 && (
          <p className="small" style={{ margin: 0 }}>
            食事：記録した日 {meals.recorded}／7
            {meals.eightDays > 0 && `　腹八分目で止められた日 ${meals.eightDays}日`}
            {meals.medianFastingHours !== null && `　空腹時間の中央値 ${meals.medianFastingHours}時間`}
            {mealPause.shouldPause && (
              <span className="note-line" style={{ display: 'block', marginTop: 6, borderLeftColor: 'var(--ember)' }}>
                体からのサインが出ています。来週は段階を戻すか、いったん普通に食べてください。
              </span>
            )}
          </p>
        )}
        {summary.meditation.days > 0 && (
          <p className="small" style={{ margin: 0 }}>
            瞑想 <strong className="num">{summary.meditation.days}</strong>日／7
            （{summary.meditation.sessions}回・{summary.meditation.totalMinutes}分）
            <span className="muted" style={{ display: 'block' }}>効果は合計時間より、置けた日数のほうに効くとされています。</span>
          </p>
        )}
        <p className="small" style={{ margin: 0 }}>
          勤務 {summary.workDays}日／休み {summary.offDays}日
          {summary.bedtime.planned > 0 && (
            <>　就寝目標 {summary.bedtime.met}/{summary.bedtime.recorded}日 達成
              {summary.bedtime.late > 0 && `（超過は平均 ${summary.bedtime.averageLateMinutes}分）`}
            </>
          )}
        </p>

        {summary.perHabit.length > 0 && (
          <div>
            <p className="section-title">習慣ごとの日数</p>
            <div className="stack" style={{ gap: 6 }}>
              {summary.perHabit.map(({ habit, done, possible }) => (
                <div className="row" key={habit.id} style={{ flexWrap: 'nowrap', gap: 8 }}>
                  <span className="small" style={{ flex: 1, minWidth: 0 }}>{habit.title}</span>
                  <div className="rate-bar" style={{ flex: 1, maxWidth: 120 }}>
                    <span style={{ width: `${possible ? (done / possible) * 100 : 0}%` }} />
                  </div>
                  <span className="num small">{done}/{possible}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="section-title">最高の体調：行動を置けた日数</p>
          <div className="stack" style={{ gap: 6 }}>
            {condition.perDomain.map(({ domain, days: n, possible }) => (
              <div className="row" key={domain.id} style={{ flexWrap: 'nowrap', gap: 8 }}>
                <span className="small" style={{ flex: 1, minWidth: 0 }}>{domain.icon} {domain.title}</span>
                <div className="rate-bar" style={{ flex: 1, maxWidth: 120 }}>
                  <span style={{ width: `${possible ? (n / possible) * 100 : 0}%` }} />
                </div>
                <span className="num small">{n}/{possible}</span>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            これは<strong>行動を置けた日数</strong>で、体の炎症を測ったものではありません。
            {condition.fermentKinds.length > 0 && ` 発酵食品は今週${condition.fermentKinds.length}種類（数より種類が大事とされます）。`}
          </p>
          {weakest && (
            <p className="note-line warm" style={{ margin: '6px 0 0' }}>
              来週いちばん手を付けやすいのは「{weakest.icon} {weakest.title}」です。
            </p>
          )}
          {sleepQuality.weakest && (
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              眠りの質でよく外れていたのは「{sleepQuality.weakest.label}」（{sleepQuality.weakestCount}日）。{sleepQuality.weakest.hint}
            </p>
          )}
        </div>

        <div className="chips">
          {summary.days.map((d) => (
            <button key={d} type="button" className="chip" onClick={() => onSelectDay(d)}>
              {Number(d.slice(-2))}日
            </button>
          ))}
        </div>
      </div>

      {/* 2. 管理者視点 */}
      <div className="card">
        <h3>🗂 管理者の目で見る</h3>
        <p className="small muted" style={{ margin: 0 }}>
          先に<strong>計画のほう</strong>を見ます。できなかったのは、たいてい実行役のせいではなく、
          計画が実態に合っていなかったからです。
        </p>

        <div>
          <p className="section-title">計画どおりに進んだか</p>
          <div className="chips">
            {MANAGER_PLAN_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className="chip"
                aria-pressed={review.manager.planFollowed === o.id}
                onClick={() => patch({ manager: { ...review.manager, planFollowed: o.id } })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="section-title">置いた量は合っていたか</p>
          <div className="chips">
            {MANAGER_ALLOCATION_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className="chip"
                aria-pressed={review.manager.allocation === o.id}
                onClick={() => patch({ manager: { ...review.manager, allocation: o.id } })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <p className="note-line warm" style={{ margin: 0 }}>{hint}</p>

        <label className="field">
          <span className="field-label">来週の計画をどう直すか（任意）</span>
          <textarea
            rows={3}
            maxLength={REVIEW_TEXT_MAX}
            value={review.manager.note}
            placeholder="例：勤務日は習慣を3つに絞る"
            onChange={(e) => patch({ manager: { ...review.manager, note: e.target.value } })}
          />
        </label>
      </div>

      {/* 3. 実行者視点 */}
      <div className="card">
        <h3>🏃 実行者の目で見る</h3>
        <p className="small muted" style={{ margin: 0 }}>実際にやってみた感触と、詰まったところを残します。</p>
        <div className="chips">
          {DOER_FEEL_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className="chip"
              aria-pressed={review.doer.feel === o.id}
              onClick={() => patch({ doer: { ...review.doer, feel: o.id } })}
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="field-label">詰まったところ（任意）</span>
          <textarea
            rows={3}
            maxLength={REVIEW_TEXT_MAX}
            value={review.doer.stuck}
            placeholder="例：勤務明けは机に向かえなかった"
            onChange={(e) => patch({ doer: { ...review.doer, stuck: e.target.value } })}
          />
        </label>
      </div>

      {/* 4. 3項目 */}
      <div className="card paper">
        <h3>週次振り返り</h3>
        <label className="field">
          <span className="field-label">うまくできたこと</span>
          <textarea rows={3} maxLength={REVIEW_TEXT_MAX} value={review.good} onChange={(e) => patch({ good: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">改善できたこと</span>
          <textarea rows={3} maxLength={REVIEW_TEXT_MAX} value={review.improve} onChange={(e) => patch({ improve: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">来週集中すべきこと</span>
          <textarea rows={3} maxLength={REVIEW_TEXT_MAX} value={review.focus} onChange={(e) => patch({ focus: e.target.value })} />
        </label>
        <p className="small muted" style={{ margin: 0 }}>
          1つでも書けば、ステップ⑦の習慣にチェックが入ります（3つ全部を埋める必要はありません）。
        </p>
      </div>
    </div>
  );
}
