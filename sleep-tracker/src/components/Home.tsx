import type { SleepRecord } from '../types/sleep';
import { WAKE_STATE_EMOJI, WAKE_STATE_LABELS } from '../types/sleep';
import { formatDateLabel, todayISODate } from '../lib/time';
import { groggyHourBuckets } from '../lib/analysis';

export default function Home({
  records,
  onStartNap,
  onNewRecord,
}: {
  records: SleepRecord[];
  onStartNap: (min: number) => void;
  onNewRecord: () => void;
}) {
  const latest = records[0];
  const todayRecord = records.find((r) => r.date === todayISODate());
  const buckets = groggyHourBuckets(records).filter((b) => b.count >= 2);
  const nextWarning = pickUpcomingWarning(buckets);

  return (
    <>
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
          <div className="subtle">最初の記録を入力すると、ここにサマリーが表示されます。</div>
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

      <button className="btn btn-ghost" onClick={onNewRecord}>
        {todayRecord ? '＋ 今日の記録を編集' : '＋ 今日の記録を入力'}
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
    </>
  );
}

function pickUpcomingWarning(buckets: { hour: number; count: number; avgIntensity: number }[]) {
  if (buckets.length === 0) return null;
  const nowHour = new Date().getHours();
  const upcoming = buckets.find((b) => b.hour >= nowHour);
  return upcoming ?? buckets[0];
}
