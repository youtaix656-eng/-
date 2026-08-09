import type { ShiftLog } from '../../types/work';
import { SYMPTOM_TYPE_LABELS, VENTILATION_LABELS } from '../../types/work';
import { findTodayShift } from '../../lib/todayShift';

export default function WorkTab({
  shifts,
  onOpenShiftStart,
  onOpenSymptomLog,
}: {
  shifts: ShiftLog[];
  onOpenShiftStart: () => void;
  onOpenSymptomLog: () => void;
}) {
  const today = findTodayShift(shifts);
  const todaySymptoms = [...(today?.symptoms ?? [])].reverse();

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={onOpenSymptomLog}
        style={{ fontSize: 19, padding: '26px 16px', fontWeight: 800 }}
      >
        🚨 症状を記録
      </button>

      {!today?.startTime && (
        <div className="reminder-banner">
          <span className="title">今日の勤務がまだ開始されていません</span>
          <button className="btn btn-secondary" onClick={onOpenShiftStart}>
            勤務を開始
          </button>
        </div>
      )}

      {today?.startTime && (
        <div className="card">
          <div className="card-label">今日の勤務</div>
          <div className="pill-row">
            <span className="pill">開始 {today.startTime}</span>
            <span
              className="pill"
              style={
                today.ventilation === 'broken'
                  ? { borderColor: 'var(--moya)', color: 'var(--moya)' }
                  : undefined
              }
            >
              換気扇 {VENTILATION_LABELS[today.ventilation]}
            </span>
            {today.priorSleepHours !== undefined && (
              <span className="pill" style={{ borderColor: 'var(--sleep)', color: 'var(--sleep)' }}>
                前夜 {today.priorSleepHours}h
              </span>
            )}
            {today.caffeine.taken && <span className="pill">カフェイン {today.caffeine.time ?? ''}</span>}
          </div>
          <button className="text-link" onClick={onOpenShiftStart}>
            編集する
          </button>
        </div>
      )}

      <div className="field">
        <div className="section-title">今日の症状ログ（{todaySymptoms.length}件）</div>
        {todaySymptoms.length === 0 ? (
          <div className="empty-state">まだ記録がありません。症状が出たら上のボタンからすぐ記録できます。</div>
        ) : (
          <div className="card" style={{ padding: '4px 14px' }}>
            {todaySymptoms.map((s) => (
              <div key={s.id} className="list-row">
                <span>
                  <span className="t">{s.time}</span>
                  <br />
                  {s.types.map((t) => SYMPTOM_TYPE_LABELS[t]).join(' / ')}
                  {s.otherNote ? `（${s.otherNote}）` : ''}
                </span>
                <span
                  className="pill"
                  style={
                    s.intensity >= 4
                      ? { borderColor: 'var(--moya)', color: 'var(--moya)' }
                      : undefined
                  }
                >
                  強さ {s.intensity}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
