import { useMemo, useState } from 'react';
import { actions } from '../lib/useStore';
import { addDays, formatWeekRangeJa, startOfWeek } from '../lib/date';
import {
  buildWeekSummary, compareWeeks, emptyReview, isReviewWritten, isWeekReviewable, managerHint,
  MANAGER_ALLOCATION_OPTIONS, MANAGER_PLAN_OPTIONS, DOER_FEEL_OPTIONS, REVIEW_TEXT_MAX,
} from '../lib/weekly';
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

      {/* 1. 事実 */}
      <div className="card">
        <h3>この週にあったこと</h3>
        <div className="row">
          <span className="num" style={{ fontSize: '1.6rem', color: 'var(--dawn)' }}>{Math.round(summary.averageRate * 100)}</span>
          <span className="small muted">% ／ 記録した日の平均達成率</span>
        </div>
        <div className="rate-bar" aria-hidden="true"><span style={{ width: `${Math.round(summary.averageRate * 100)}%` }} /></div>
        {comparison && <p className="small muted" style={{ margin: 0 }}>{comparison.text}</p>}

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
