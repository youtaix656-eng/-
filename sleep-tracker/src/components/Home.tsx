import type { SleepRecord } from '../types/sleep';
import { WAKE_STATE_EMOJI, WAKE_STATE_LABELS } from '../types/sleep';
import type { AppSettings } from '../types/settings';
import { formatDateLabel, todayISODate } from '../lib/time';
import { groggyHourBuckets, recentAverageHours, recentTotalHours } from '../lib/analysis';
import { computeStreak } from '../lib/streak';
import Clock from './Clock';
import AnimalFactCard from './AnimalFactCard';

export default function Home({
  records,
  settings,
  onStartNap,
  onOpenQuickWake,
  onOpenNapQuickAdd,
  onOpenGroggyQuickAdd,
  onOpenEveningReflection,
  onOpenFullForm,
}: {
  records: SleepRecord[];
  settings: AppSettings;
  onStartNap: (min: number) => void;
  onOpenQuickWake: () => void;
  onOpenNapQuickAdd: () => void;
  onOpenGroggyQuickAdd: () => void;
  onOpenEveningReflection: () => void;
  onOpenFullForm: () => void;
}) {
  const latest = records[0];
  const todayRecord = records.find((r) => r.date === todayISODate());
  const needsWakeLog = !todayRecord?.coreSleep.start;
  const streak = computeStreak(records);
  const weeklyAvg = recentAverageHours(records, 7);
  const buckets = groggyHourBuckets(records).filter((b) => b.count >= 2);
  const nextWarning = pickUpcomingWarning(buckets);

  const weeklyTotal = recentTotalHours(records, 7);
  const target = settings.targetWeeklyHours;
  const achievementPct = target ? Math.round((weeklyTotal / target) * 100) : null;

  return (
    <>
      <Clock />

      {needsWakeLog && (
        <div className="reminder-banner">
          <span className="title">
            {todayRecord ? '今日の就寝・起床がまだ記録されていません' : '今日の記録がまだありません'}
          </span>
          <button className="btn btn-primary" onClick={onOpenQuickWake}>
            睡眠を記録する
          </button>
        </div>
      )}

      {records.length > 0 && (
        <div className="stat-row">
          <div className="stat-chip">
            <span className="stat-value">🔥 {streak}日</span>
            <span className="stat-label">連続記録</span>
          </div>
          <div className="stat-chip">
            <span className="stat-value">{weeklyAvg ? `${weeklyAvg}h` : '–'}</span>
            <span className="stat-label">今週の平均睡眠時間</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-label">{latest ? `直近の記録（${formatDateLabel(latest.date)}）` : '記録がまだありません'}</div>
        {latest ? (
          <>
            <div className="big-num">
              {latest.totalSleepHours}
              <span className="unit">h</span>
            </div>
            <div className="pill-row" style={{ marginTop: 8 }}>
              {latest.coreSleep.start && (
                <span className="pill" style={{ borderColor: 'var(--sleep)', color: 'var(--sleep)' }}>
                  コア {latest.coreSleep.start}–{latest.coreSleep.end}
                </span>
              )}
              {latest.naps.map((n) => (
                <span key={n.id} className="pill" style={{ borderColor: 'var(--nap)', color: 'var(--nap)' }}>
                  仮眠 {n.start}–{n.end}
                </span>
              ))}
              <span className="pill">
                {WAKE_STATE_EMOJI[latest.wakeState]} {WAKE_STATE_LABELS[latest.wakeState]}
              </span>
            </div>
          </>
        ) : (
          <div className="subtle">「睡眠を記録する」から最初の記録を入力すると、ここにサマリーが表示されます。</div>
        )}
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => onStartNap(20)}>
          仮眠 20分
        </button>
        <button className="btn btn-primary" onClick={() => onStartNap(30)}>
          仮眠 30分
        </button>
      </div>

      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onOpenNapQuickAdd}>
          ＋ 仮眠を後から記録
        </button>
        <button className="btn btn-ghost" onClick={onOpenGroggyQuickAdd}>
          ＋ モヤを記録
        </button>
      </div>

      <button className="btn btn-ghost" onClick={onOpenEveningReflection}>
        🌙 今日の振り返り
      </button>

      <button className="text-link" onClick={onOpenFullForm}>
        モヤ・学習パフォーマンス・メモも詳しく編集する
      </button>

      {nextWarning && (
        <div className="card" style={{ borderColor: 'var(--moya)' }}>
          <div className="card-label" style={{ color: 'var(--moya)' }}>
            今日のモヤ予測
          </div>
          <div style={{ fontSize: 13.5 }}>
            {nextWarning.hour}:00〜{(nextWarning.hour + 2) % 24}:00 頃に注意（過去{nextWarning.count}件の傾向）
          </div>
        </div>
      )}

      {target && (
        <div className="card">
          <div className="card-label">週の目標睡眠時間</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span className="big-num" style={{ fontSize: 20 }}>
              {weeklyTotal}
              <span className="unit">/{target}h</span>
            </span>
            <span className="subtle">{achievementPct}%</span>
          </div>
          <div style={{ background: 'var(--border-soft)', borderRadius: 4, height: 8, marginTop: 8 }}>
            <div
              style={{
                width: `${Math.min(100, achievementPct ?? 0)}%`,
                background: 'var(--text)',
                height: '100%',
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      )}

      <AnimalFactCard userAverageHours={weeklyAvg} />
    </>
  );
}

function pickUpcomingWarning(buckets: { hour: number; count: number; avgIntensity: number }[]) {
  if (buckets.length === 0) return null;
  const nowHour = new Date().getHours();
  const upcoming = buckets.find((b) => b.hour >= nowHour);
  return upcoming ?? buckets[0];
}
