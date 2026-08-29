import React, { useMemo } from 'react';
import { actions } from '../lib/useStore.js';
import { buildPlan } from '../lib/plan.js';
import { onboardingSteps, allDone, nextStep } from '../lib/steps.js';
import { todayCount, totalCount, activeDays, todayMinutes } from '../lib/pomodoro.js';
import { PHASE_META } from '../lib/schedule.js';
import { parseDate, formatDate } from '../lib/schedule.js';

// ホーム。**ここで迷わせない**——出すのは「今どこにいるか」と「次の1つ」だけ。
// 下部ナビ・上部バーから行ける所は、ここに二重で置かない。

export default function Home({ state, go }) {
  const plan = useMemo(() => buildPlan(state), [state]);
  const steps = onboardingSteps(state);
  const done = allDone(state);
  const next = nextStep(state);
  const today = todayCount(state.pomodoroLog);

  const phase = currentPhase(plan);

  return (
    <div>
      <h2>🏠 ホーム</h2>

      {!done && (
        <div className="card accent">
          <h3 style={{ marginTop: 0 }}>はじめの道しるべ</h3>
          <p className="muted">実際の状態から自動で付きます（手で印を付けるところはありません）。</p>
          <ul className="step-list">
            {steps.map((st) => (
              <li key={st.id}>
                <span className="step-mark">{st.done ? '✅' : st.optional ? '⭕️' : '⬜️'}</span>
                <span style={{ flex: 1 }}>
                  {st.label}
                  {st.optional && !st.done && <span className="muted">（飛ばせます）</span>}
                </span>
                {!st.done && (
                  <button type="button" className="small" onClick={() => go(st.view)}>
                    開く
                  </button>
                )}
              </li>
            ))}
          </ul>
          {next && (
            <div className="btn-row">
              <button type="button" className="primary" onClick={() => go(next.view)}>
                次にやること：{next.label} →
              </button>
            </div>
          )}
        </div>
      )}

      {plan.exam && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{plan.exam.name}</h3>
          {plan.schedule ? (
            <>
              <p style={{ fontSize: '1.1em' }}>
                試験日まで <strong>{plan.schedule.days}日</strong>（約{plan.schedule.weeks}週）
              </p>
              {phase && (
                <p>
                  いまは <strong>{phase.label}</strong>：{phase.aim}
                </p>
              )}
              {phase && (
                <>
                  <p className="muted">この時期にやること：</p>
                  <ul>
                    {phase.dos.slice(0, 3).map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p className="muted">試験日を入れると、残り日数と今の時期が出ます。</p>
          )}
          <div className="btn-row">
            <button type="button" onClick={() => go('plan')}>
              計画を見る
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>🍅 今日のポモドーロ</h3>
        <p style={{ fontSize: '1.1em' }}>
          今日 <strong>{today}本</strong>（約{todayMinutes(state.pomodoroLog, state.pomodoro)}分）
        </p>
        <p className="muted">
          通算 {totalCount(state.pomodoroLog)}本・{activeDays(state.pomodoroLog)}日。
          <br />
          <strong>連続日数は出していません。</strong>1日休んでも数字は減りません。
          途切れたことを気にして開かなくなるほうが、失うものが大きいためです。
        </p>
        <p className="muted">タイマーは画面のいちばん上にいつも出ています。</p>
      </div>

      {plan.questionCount > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>収録した問題</h3>
          <p style={{ fontSize: '1.1em' }}>
            <strong>{plan.questionCount}問</strong>
          </p>
          <div className="btn-row">
            <button type="button" onClick={() => go('convert')}>
              問題を見る・増やす
            </button>
            <button type="button" onClick={() => go('spec')}>
              設計書に同梱する
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>このアプリについて</h3>
        <ul>
          <li>保存先は<strong>この端末の中だけ</strong>です。どこにも送りません。</li>
          <li><strong>AIはこのアプリからは呼びません。</strong>作るのは「AIに貼る文章」です（APIキーは要りません）。</li>
          <li>合格率・合格点・試験日などの<strong>毎年変わる数字は、わざと持っていません</strong>。公式で確かめてください。</li>
        </ul>
      </div>
    </div>
  );
}

/** 今日がどの時期に入っているか。**入っていなければ null**（勝手に近い方へ寄せない） */
function currentPhase(plan) {
  if (!plan?.schedule) return null;
  const today = formatDate(new Date());
  return plan.schedule.phases.find((p) => p.startDate <= today && today <= p.endDate) || null;
}
