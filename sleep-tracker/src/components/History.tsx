import type { SleepRecord } from '../types/sleep';
import { WAKE_STATE_EMOJI } from '../types/sleep';
import { formatDateLabel } from '../lib/time';

export default function History({
  records,
  onEdit,
  onDelete,
}: {
  records: SleepRecord[];
  onEdit: (record: SleepRecord) => void;
  onDelete: (id: string) => void;
}) {
  if (records.length === 0) {
    return <div className="empty-state">まだ記録がありません。ホームの「＋」から記録を追加できます。</div>;
  }

  function handleDelete(e: React.MouseEvent, r: SleepRecord) {
    e.stopPropagation();
    if (window.confirm(`${formatDateLabel(r.date)} の記録を削除しますか？`)) {
      onDelete(r.id);
    }
  }

  return (
    <div className="card" style={{ padding: '4px 14px' }}>
      {records.map((r) => {
        const core = coreHours(r);
        return (
          <div key={r.id} className="list-row" onClick={() => onEdit(r)} style={{ cursor: 'pointer' }}>
            <span>
              {formatDateLabel(r.date)}
              <br />
              <span className="t">
                {core > 0 ? `コア${core}h` : ''}
                {r.naps.length > 0 ? `${core > 0 ? ' + ' : ''}仮眠${r.naps.length}回` : ''}
                {core === 0 && r.naps.length === 0 ? '未入力' : ''}
              </span>
            </span>
            <span className="pill-row">
              <span className="pill">
                {WAKE_STATE_EMOJI[r.wakeState]} 学習{r.studyPerformance}
              </span>
              <button className="icon-btn" onClick={(e) => handleDelete(e, r)} aria-label="削除">
                🗑
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function coreHours(r: SleepRecord): number {
  if (!r.coreSleep.start || !r.coreSleep.end) return 0;
  const [sh, sm] = r.coreSleep.start.split(':').map(Number);
  const [eh, em] = r.coreSleep.end.split(':').map(Number);
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  const min = e > s ? e - s : 1440 - s + e;
  return Math.round((min / 60) * 10) / 10;
}
