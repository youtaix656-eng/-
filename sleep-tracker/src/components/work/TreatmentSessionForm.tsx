import { useState } from 'react';
import type { ShiftLog, TreatmentType } from '../../types/work';
import { TREATMENT_TYPE_LABELS, TREATMENT_TYPES } from '../../types/work';
import { attachSessionToTodayShift } from '../../lib/todayShift';
import { newId } from '../../lib/id';
import { addMinutesToTime } from '../../lib/time';

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TreatmentSessionForm({
  shifts,
  onClose,
  onSave,
}: {
  shifts: ShiftLog[];
  onClose: () => void;
  onSave: (shift: ShiftLog) => void | Promise<void>;
}) {
  const [type, setType] = useState<TreatmentType>('body_massage');
  const [startTime, setStartTime] = useState(addMinutesToTime(nowHHMM(), -60));
  const [endTime, setEndTime] = useState(nowHHMM());
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const shift = attachSessionToTodayShift(shifts, { id: newId(), type, startTime, endTime });
    await onSave(shift);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-head">
          <h2>施術を記録</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="field">
          <span className="lbl">施術種別</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {TREATMENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`seg ${type === t ? 'on' : ''}`}
                onClick={() => setType(t)}
                style={{ fontSize: 15, padding: '14px 6px', fontWeight: 700 }}
              >
                {TREATMENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <span className="lbl">開始</span>
            <input type="time" className="inp" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="field">
            <span className="lbl">終了</span>
            <input type="time" className="inp" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        <div className="btn-row">
          <button className="btn btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
