import type { ShiftLog } from '../../types/work';
import { COPING_METHOD_LABELS } from '../../types/work';
import {
  caffeineSymptomStats,
  copingEffectSummary,
  priorSleepVsSymptoms,
  suspectScore,
  ventilationSymptomStats,
  weeklyWorkSummary,
} from '../../lib/workAnalysis';

export default function WorkReport({ shifts, onClose }: { shifts: ShiftLog[]; onClose: () => void }) {
  const suspects = suspectScore(shifts);
  const vent = ventilationSymptomStats(shifts);
  const caf = caffeineSymptomStats(shifts);
  const sleepBuckets = priorSleepVsSymptoms(shifts);
  const coping = copingEffectSummary(shifts);
  const weekly = weeklyWorkSummary(shifts, 7);
  const totalSymptoms = shifts.reduce((sum, s) => sum + s.symptoms.length, 0);
  const workedDays = shifts.filter((s) => s.startTime && !s.dayOff).length;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet work-report-sheet">
        <div className="modal-head no-print">
          <h2>コンディション記録レポート</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <div>
          <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>施術中コンディション記録 レポート</h1>
          <div className="subtle">
            作成日: {new Date().toLocaleDateString('ja-JP')} ／ 記録日数: {shifts.length}日（うち勤務あり {workedDays}日） ／ 症状記録:{' '}
            {totalSymptoms}件
          </div>
        </div>

        {suspects.length > 0 && (
          <div className="card">
            <div className="card-label">最も疑わしい要因</div>
            {suspects.map((s) => (
              <div key={s.factor} style={{ marginTop: 6 }}>
                <b>{s.label}</b>：{s.detail}
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div className="card-label">換気扇の状態と症状</div>
          <div>正常日：{vent.normal.days}日／症状{vent.normal.symptomCount}件／1日あたり{vent.normal.perDay}件／平均強度{vent.normal.avgIntensity || '–'}</div>
          <div>故障日：{vent.broken.days}日／症状{vent.broken.symptomCount}件／1日あたり{vent.broken.perDay}件／平均強度{vent.broken.avgIntensity || '–'}</div>
        </div>

        <div className="card">
          <div className="card-label">カフェイン摂取と症状</div>
          <div>
            摂取あり：{caf.withCaffeine.days}日／1日あたり{caf.withCaffeine.perDay}件／平均強度{caf.withCaffeine.avgIntensity || '–'}
          </div>
          <div>
            摂取なし：{caf.withoutCaffeine.days}日／1日あたり{caf.withoutCaffeine.perDay}件／平均強度{caf.withoutCaffeine.avgIntensity || '–'}
          </div>
        </div>

        <div className="card">
          <div className="card-label">前夜の睡眠時間と症状</div>
          {sleepBuckets.length === 0 ? (
            <div className="subtle">データ不足</div>
          ) : (
            sleepBuckets.map((b) => (
              <div key={b.label}>
                {b.label}：{b.days}日／1日あたり{b.perDay}件／平均強度{b.avgIntensity || '–'}
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-label">対処法の効果</div>
          {coping.length === 0 ? (
            <div className="subtle">記録なし</div>
          ) : (
            coping.map((c) => (
              <div key={c.method}>
                {COPING_METHOD_LABELS[c.method]}：効果あり率 {Math.round(c.workedRate * 100)}%（{c.total}回試行）
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-label">直近7日サマリー</div>
          <div>
            {weekly.peakHourLabel ? `最も症状が出やすい時間帯：${weekly.peakHourLabel}（${weekly.peakHourCount}件）` : '症状記録なし'}
          </div>
          <div>
            カフェイン摂取日：1日あたり{weekly.caffeineDayAvg}件 ／ 非摂取日：1日あたり{weekly.nonCaffeineDayAvg}件
          </div>
        </div>

        <button className="btn btn-primary no-print" onClick={() => window.print()}>
          印刷 / PDFで保存
        </button>
      </div>
    </div>
  );
}
