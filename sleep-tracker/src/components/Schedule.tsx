import { useMemo, useState } from 'react';
import type { SleepRecord } from '../types/sleep';
import { buildScheduleSuggestion } from '../lib/scheduleEngine';

export default function Schedule({ records }: { records: SleepRecord[] }) {
  const lastWorkEnd = records.find((r) => r.workEndTime)?.workEndTime ?? '00:00';
  const [workEndTime, setWorkEndTime] = useState(lastWorkEnd);

  const suggestion = useMemo(() => buildScheduleSuggestion(workEndTime, records), [workEndTime, records]);

  return (
    <>
      <div className="field">
        <span className="lbl">勤務終了時刻</span>
        <input type="time" className="inp" value={workEndTime} onChange={(e) => setWorkEndTime(e.target.value)} />
      </div>

      <div className="field">
        <div className="section-title">推奨スケジュール</div>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <TimelineItem color="var(--sleep)" label="コア睡眠" time={`${suggestion.coreSleep.start}〜${suggestion.coreSleep.end}`} />
            {suggestion.naps.map((n, i) => (
              <TimelineItem key={i} color="var(--moya)" label="予防仮眠" time={`${n.start}〜${n.end}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {suggestion.preventiveNapNotes.map((note, i) => (
          <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0' }}>
            {note}
          </p>
        ))}
      </div>

      <div className="subtle">
        深夜をまたぐ直後の時刻は、夜勤の感覚に合わせて「25:00」のような表記にしています。
      </div>
    </>
  );
}

function TimelineItem({ color, label, time }: { color: string; label: string; time: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 6, flex: 'none' }} />
      <div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {time}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{label}</div>
      </div>
    </div>
  );
}
