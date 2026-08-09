import type { ShiftLog } from '../../types/work';
import { COPING_METHOD_LABELS, TREATMENT_TYPE_LABELS } from '../../types/work';
import type { SleepRecord } from '../../types/sleep';
import {
  caffeineSymptomStats,
  combinedDrowsinessTimeline,
  copingEffectSummary,
  priorSleepVsSymptoms,
  suspectScore,
  treatmentTypeSymptomStats,
  ventilationSymptomStats,
  weeklyWorkSummary,
} from '../../lib/workAnalysis';
import { toMinutes, formatDateLabel } from '../../lib/time';

function ComparisonBars({
  title,
  left,
  leftLabel,
  leftColor,
  right,
  rightLabel,
  rightColor,
}: {
  title: string;
  left: { days: number; perDay: number; avgIntensity: number };
  leftLabel: string;
  leftColor: string;
  right: { days: number; perDay: number; avgIntensity: number };
  rightLabel: string;
  rightColor: string;
}) {
  const max = Math.max(1, left.perDay, right.perDay);
  return (
    <div className="card">
      <div className="card-label">{title}</div>
      {left.days === 0 && right.days === 0 ? (
        <div className="subtle">記録が貯まると比較できます。</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
          {[
            { stat: left, label: leftLabel, color: leftColor },
            { stat: right, label: rightLabel, color: rightColor },
          ].map((row) => (
            <div key={row.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>
                  {row.label}（{row.stat.days}日）
                </span>
                <span className="subtle">
                  1日{row.stat.perDay}件・平均強度{row.stat.avgIntensity || '–'}
                </span>
              </div>
              <div style={{ background: 'var(--border-soft)', borderRadius: 4, height: 10 }}>
                <div
                  style={{
                    width: `${(row.stat.perDay / max) * 100}%`,
                    background: row.color,
                    height: '100%',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkAnalysis({ shifts, records }: { shifts: ShiftLog[]; records: SleepRecord[] }) {
  const suspects = suspectScore(shifts);
  const vent = ventilationSymptomStats(shifts);
  const caf = caffeineSymptomStats(shifts);
  const sleepBuckets = priorSleepVsSymptoms(shifts);
  const maxSleepPerDay = Math.max(1, ...sleepBuckets.map((b) => b.perDay));
  const coping = copingEffectSummary(shifts);
  const treatmentStats = treatmentTypeSymptomStats(shifts);
  const maxTreatmentRate = Math.max(1, ...treatmentStats.map((t) => t.rate));
  const weekly = weeklyWorkSummary(shifts, 7);
  const timeline = combinedDrowsinessTimeline(records, shifts, 14);

  const gridShifts = [...shifts]
    .filter((s) => s.startTime && !s.dayOff)
    .slice(0, 7);

  if (shifts.length === 0) {
    return <div className="empty-state">勤務ログが貯まるとここに相関分析が表示されます。</div>;
  }

  return (
    <>
      {suspects.length > 0 && (
        <div className="field">
          <div className="section-title">今いちばん怪しい原因</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suspects.map((s) => (
              <div
                key={s.factor}
                className="card"
                style={{ borderColor: s.severity === 'high' ? 'var(--moya)' : 'var(--border)' }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: s.severity === 'high' ? 'var(--moya)' : 'var(--text)' }}>
                  {s.severity === 'high' ? '🔴 ' : '🟡 '}
                  {s.label}
                </div>
                <div className="subtle" style={{ marginTop: 4 }}>
                  {s.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ComparisonBars
        title="① 換気扇 正常日 vs 故障日"
        left={vent.normal}
        leftLabel="正常"
        leftColor="var(--sleep)"
        right={vent.broken}
        rightLabel="故障"
        rightColor="var(--moya)"
      />

      <ComparisonBars
        title="② カフェイン摂取 有無"
        left={caf.withoutCaffeine}
        leftLabel="なし"
        leftColor="var(--sleep)"
        right={caf.withCaffeine}
        rightLabel="あり"
        rightColor="var(--amber, var(--moya))"
      />
      <div className="subtle" style={{ marginTop: -8 }}>
        カフェイン摂取日は1日あたり{caf.withCaffeine.perDay}件、非摂取日は{caf.withoutCaffeine.perDay}件（エナジードリンクを含む）。
      </div>

      <div className="field">
        <div className="section-title">③ 前夜の睡眠時間 × 症状</div>
        <div className="card">
          {sleepBuckets.length === 0 ? (
            <div className="subtle">記録が貯まると比較できます。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sleepBuckets.map((b) => (
                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 48, fontSize: 11.5, color: 'var(--text-faint)', flex: 'none' }}>{b.label}</span>
                  <div style={{ flex: 1, background: 'var(--border-soft)', borderRadius: 4, height: 8 }}>
                    <div
                      style={{
                        width: `${(b.perDay / maxSleepPerDay) * 100}%`,
                        background: 'var(--sleep)',
                        height: '100%',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span style={{ width: 60, fontSize: 11, textAlign: 'right', flex: 'none' }} className="subtle">
                    {b.perDay}件/日
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="field">
        <div className="section-title">④ 症状の発生時刻 × 換気扇の状態（直近7日）</div>
        <div className="card">
          {gridShifts.length === 0 ? (
            <div className="subtle">勤務開始が記録されると表示されます。</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {gridShifts.map((shift) => (
                  <div key={shift.id} style={{ display: 'grid', gridTemplateColumns: '54px repeat(24, 1fr)', gap: 2, alignItems: 'center' }}>
                    <span style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>{formatDateLabel(shift.date)}</span>
                    {Array.from({ length: 24 }).map((_, hour) => {
                      const atHour = shift.symptoms.filter((s) => Math.floor(toMinutes(s.time) / 60) === hour);
                      const maxIntensity = atHour.length ? Math.max(...atHour.map((s) => s.intensity)) : 0;
                      const ventColor =
                        shift.ventilation === 'broken' ? 'var(--moya)' : shift.ventilation === 'normal' ? 'var(--sleep)' : 'var(--border-soft)';
                      return (
                        <div
                          key={hour}
                          title={atHour.length ? `${hour}時台: ${atHour.length}件` : undefined}
                          style={{
                            paddingTop: '100%',
                            borderRadius: 2,
                            background: ventColor,
                            opacity: atHour.length ? 0.3 + 0.6 * (maxIntensity / 5) : 0.08,
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="legend" style={{ marginTop: 8 }}>
                <span className="item">
                  <span className="swatch" style={{ background: 'var(--moya)' }} /> 換気扇故障日
                </span>
                <span className="item">
                  <span className="swatch" style={{ background: 'var(--sleep)' }} /> 正常日
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="field">
        <div className="section-title">⑥⑦ 対処法の効果</div>
        <div className="card">
          {coping.length === 0 ? (
            <div className="subtle">症状を記録したあとの「対処法」で効果を選ぶと、ここに集計されます。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {coping.map((c) => (
                <div key={c.method} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{COPING_METHOD_LABELS[c.method]}</span>
                  <span className="pill" style={{ borderColor: 'var(--nap)', color: 'var(--nap)' }}>
                    効果あり率 {Math.round(c.workedRate * 100)}%
                  </span>
                  <span className="subtle">{c.total}回試行</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="field">
        <div className="section-title">⑩ 施術種別ごとの症状発生率</div>
        <div className="card">
          {treatmentStats.length === 0 ? (
            <div className="subtle">「施術を記録」で施術種別を記録すると、ここに集計されます。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {treatmentStats.map((t) => (
                <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 96, fontSize: 12.5, flex: 'none' }}>{TREATMENT_TYPE_LABELS[t.type]}</span>
                  <div style={{ flex: 1, background: 'var(--border-soft)', borderRadius: 4, height: 8 }}>
                    <div
                      style={{
                        width: `${(t.rate / maxTreatmentRate) * 100}%`,
                        background: 'var(--moya)',
                        height: '100%',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span className="subtle" style={{ width: 76, textAlign: 'right', fontSize: 11 }}>
                    {t.rate}件/施術（{t.sessionCount}回）
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="field">
        <div className="section-title">⑰⑱ 週次サマリー</div>
        <div className="card">
          <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
            {weekly.peakHourLabel
              ? `直近7日で最も症状が出やすいのは ${weekly.peakHourLabel}（${weekly.peakHourCount}件）です。`
              : 'この7日間はまだ症状の記録がありません。'}
            <br />
            カフェインを摂った日は1日あたり{weekly.caffeineDayAvg}件、摂らなかった日は{weekly.nonCaffeineDayAvg}件でした。
          </div>
        </div>
      </div>

      <div className="field">
        <div className="section-title">⑳ 眠気の統合タイムライン（睡眠アプリ＋勤務ログ）</div>
        <div className="card" style={{ padding: '4px 14px' }}>
          {timeline.length === 0 ? (
            <div className="subtle" style={{ padding: '10px 0' }}>
              直近14日の記録がありません。
            </div>
          ) : (
            timeline.slice(0, 20).map((e, i) => (
              <div key={i} className="list-row">
                <span>
                  <span className="t">
                    {formatDateLabel(e.date)} {e.time}
                  </span>
                  <br />
                  {e.label}
                </span>
                <span
                  className="pill"
                  style={
                    e.source === 'work'
                      ? { borderColor: 'var(--moya)', color: 'var(--moya)' }
                      : { borderColor: 'var(--sleep)', color: 'var(--sleep)' }
                  }
                >
                  {e.source === 'work' ? '💆 勤務' : '😴 睡眠'} 強{e.intensity}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
