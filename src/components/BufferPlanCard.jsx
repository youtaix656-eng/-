import { useMemo, useState } from 'react';
import { DEFAULT_BASE_RATIO, planStudySession } from '../lib/bufferSession.js';
import { moodToConditionScore, MOODS } from '../lib/mood.js';

// 「⏱ 時間で計画する（3分の2バッファ術）」カード。
//   Session.jsx・Quiz.jsxの両方から使う共有コンポーネント（単一の正）。
//   学習予定時間（分）→ 基礎タスク/バッファの自動計算はplanStudySession（bufferSession.js）に委ね、
//   このコンポーネントはUIと分数の状態管理だけを持つ。実際にセッションを開始する処理は
//   呼び出し側（onStart(bufferPlan)）に委ねる（Session.jsxのbegin()とQuiz.jsxの開始方法が異なるため）。
export default function BufferPlanCard({ subject, history, settings, updateSettings, mood, onStart, startDisabled, onToast }) {
  const [planMinutes, setPlanMinutes] = useState(60);
  const standardBaseRatio = (settings.bufferBaseRatioPct ?? Math.round(DEFAULT_BASE_RATIO * 100)) / 100;
  const bufferPlan = useMemo(
    () =>
      planStudySession({
        totalMinutes: planMinutes,
        subject,
        history,
        standardRatio: standardBaseRatio,
        conditionScore: moodToConditionScore(mood),
      }),
    [planMinutes, subject, history, standardBaseRatio, mood]
  );

  return (
    <div className="card">
      <div className="section-label" style={{ marginTop: 0 }}>⏱ 時間で計画する（3分の2バッファ術）</div>
      <p className="inline-note" style={{ marginTop: 0 }}>
        学習予定時間を入力すると、基礎タスク（必須の演習）とバッファ（復習・積み残し消化用）に自動で分けます。
        「やる気が出たら」ではなく「始まる形」にして、あとからやる気がついてくる仕組みです。
      </p>
      <div className="chip-row">
        {[15, 30, 45, 60, 90, 120].map((m) => (
          <button key={m} className={`chip ${planMinutes === m ? 'active' : ''}`} onClick={() => setPlanMinutes(m)}>
            {m}分
          </button>
        ))}
      </div>
      <div className="range-row" style={{ marginTop: 8 }}>
        <input type="range" min="10" max="180" step="5" value={planMinutes} onChange={(e) => setPlanMinutes(Number(e.target.value))} />
        <span className="range-val">{planMinutes}分</span>
      </div>
      <div className="tiles" style={{ marginTop: 10 }}>
        <div className="tile">
          <div className="num">{bufferPlan.baseTaskQuestionCount}</div>
          <div className="lbl">基礎タスク（約{bufferPlan.baseTaskMinutes}分）</div>
        </div>
        <div className="tile">
          <div className="num">{bufferPlan.bufferQuestionCount}</div>
          <div className="lbl">バッファ（約{bufferPlan.bufferMinutes}分）</div>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        基礎タスク:バッファ = {Math.round(bufferPlan.ratio * 100)}:{100 - Math.round(bufferPlan.ratio * 100)}
        （設定画面で調整できます）。問題数は、あなたの過去の平均解答時間（1問あたり約{bufferPlan.secPerQuestion}秒）から概算しています。
        {mood && (
          <>
            <br />
            今日の調子「{MOODS.find((m) => m.id === mood)?.label || mood}」に合わせて±5%の範囲で調整済みです。
          </>
        )}
      </p>
      <button
        className="btn primary block lg"
        style={{ marginTop: 10 }}
        onClick={() => onStart(bufferPlan)}
        disabled={startDisabled}
      >
        この計画で基礎タスクを始める（{bufferPlan.baseTaskQuestionCount}問）
      </button>
      <button
        className="btn ghost sm block"
        style={{ marginTop: 6 }}
        onClick={() => {
          updateSettings({ pomodoro: { ...(settings.pomodoro || {}), enabled: true, study: bufferPlan.baseTaskMinutes, updatedAt: Date.now() } });
          onToast?.(`🍅 ポモドーロの勉強時間を${bufferPlan.baseTaskMinutes}分に合わせました`);
        }}
      >
        🍅 ポモドーロの勉強時間もこの分数（{bufferPlan.baseTaskMinutes}分）に合わせる
      </button>
    </div>
  );
}
