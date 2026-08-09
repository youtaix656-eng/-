import { useState } from 'react';
import type { ShiftLog } from '../../types/work';
import { COPING_METHOD_LABELS, SYMPTOM_TYPE_LABELS, TREATMENT_TYPE_LABELS, VENTILATION_LABELS } from '../../types/work';
import type { SleepRecord } from '../../types/sleep';
import { findTodayShift } from '../../lib/todayShift';
import { formatElapsed, minutesSinceShiftStart } from '../../lib/workAnalysis';
import WorkAnalysis from './WorkAnalysis';
import WorkReport from './WorkReport';

type View = 'log' | 'analysis';

export default function WorkTab({
  shifts,
  records,
  onOpenShiftStart,
  onOpenSymptomLog,
  onOpenSessionForm,
  onMarkDayOff,
}: {
  shifts: ShiftLog[];
  records: SleepRecord[];
  onOpenShiftStart: () => void;
  onOpenSymptomLog: () => void;
  onOpenSessionForm: () => void;
  onMarkDayOff: () => void;
}) {
  const [view, setView] = useState<View>('log');
  const [reportOpen, setReportOpen] = useState(false);
  const today = findTodayShift(shifts);
  const todaySymptoms = today ? [...today.symptoms].reverse() : [];
  const highIntensityCount = today?.symptoms.filter((s) => s.intensity >= 4).length ?? 0;

  return (
    <>
      <div className="tabs">
        <button className={view === 'log' ? 'active' : ''} onClick={() => setView('log')}>
          記録
        </button>
        <button className={view === 'analysis' ? 'active' : ''} onClick={() => setView('analysis')}>
          分析
        </button>
      </div>

      {view === 'log' && (
        <>
          <button
            className="btn btn-primary"
            onClick={onOpenSymptomLog}
            style={{ fontSize: 19, padding: '26px 16px', fontWeight: 800 }}
          >
            🚨 症状を記録
          </button>

          {highIntensityCount >= 2 && (
            <div className="reminder-banner" style={{ borderColor: 'var(--moya)' }}>
              <span className="title" style={{ color: 'var(--moya)' }}>
                今日は強い症状が続いています。無理をしないでください。
              </span>
            </div>
          )}

          {!today?.startTime && !today?.dayOff && (
            <div className="reminder-banner">
              <span className="title">今日の勤務がまだ開始されていません</span>
              <div className="btn-row">
                <button className="btn btn-secondary" onClick={onMarkDayOff}>
                  今日は休み
                </button>
                <button className="btn btn-primary" onClick={onOpenShiftStart}>
                  勤務を開始
                </button>
              </div>
            </div>
          )}

          {today?.dayOff && (
            <div className="card">
              <span className="subtle">今日は「休み」として記録されています。</span>
            </div>
          )}

          {today?.startTime && (
            <div className="card">
              <div className="card-label">今日の勤務</div>
              <div className="pill-row">
                <span className="pill">開始 {today.startTime}</span>
                <span
                  className="pill"
                  style={today.ventilation === 'broken' ? { borderColor: 'var(--moya)', color: 'var(--moya)' } : undefined}
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
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button className="text-link" onClick={onOpenShiftStart}>
                  編集する
                </button>
                <button className="text-link" onClick={onOpenSessionForm}>
                  ＋ 施術を記録
                </button>
              </div>
              {today.sessions.length > 0 && (
                <div className="pill-row" style={{ marginTop: 6 }}>
                  {today.sessions.map((s) => (
                    <span key={s.id} className="pill">
                      {TREATMENT_TYPE_LABELS[s.type]} {s.startTime}–{s.endTime}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="field">
            <div className="section-title">今日の症状ログ（{todaySymptoms.length}件）</div>
            {todaySymptoms.length === 0 ? (
              <div className="empty-state">まだ記録がありません。症状が出たら上のボタンからすぐ記録できます。</div>
            ) : (
              <div className="card" style={{ padding: '4px 14px' }}>
                {todaySymptoms.map((s) => {
                  const elapsed = today ? minutesSinceShiftStart(today, s.time) : null;
                  const isBlackout = s.types.includes('blackout');
                  return (
                    <div key={s.id} className="list-row" style={isBlackout ? { background: 'var(--moya-soft)' } : undefined}>
                      <span>
                        <span className="t">
                          {s.time}
                          {elapsed !== null ? `（${formatElapsed(elapsed)}）` : ''}
                        </span>
                        <br />
                        {isBlackout ? '⚠ ' : ''}
                        {s.types.map((t) => SYMPTOM_TYPE_LABELS[t]).join(' / ')}
                        {s.otherNote ? `（${s.otherNote}）` : ''}
                        {s.coping && s.coping.methods.length > 0 && (
                          <>
                            <br />
                            <span className="subtle">対処: {s.coping.methods.map((m) => COPING_METHOD_LABELS[m]).join('・')}</span>
                          </>
                        )}
                      </span>
                      <span className="pill" style={s.intensity >= 4 ? { borderColor: 'var(--moya)', color: 'var(--moya)' } : undefined}>
                        強さ {s.intensity}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {view === 'analysis' && (
        <>
          <button className="btn btn-ghost" onClick={() => setReportOpen(true)}>
            📄 レポートを出力（印刷/PDF）
          </button>
          <WorkAnalysis shifts={shifts} records={records} />
        </>
      )}

      {reportOpen && <WorkReport shifts={shifts} onClose={() => setReportOpen(false)} />}
    </>
  );
}
