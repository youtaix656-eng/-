import { useState } from 'react';
import type { ShiftLog, SymptomType } from '../../types/work';
import { SYMPTOM_TYPES, SYMPTOM_TYPE_LABELS } from '../../types/work';
import { attachSymptomToTodayShift } from '../../lib/todayShift';
import { newId } from '../../lib/id';

const INTENSITIES = [1, 2, 3, 4, 5] as const;

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function SymptomQuickLog({
  shifts,
  onClose,
  onSave,
}: {
  shifts: ShiftLog[];
  onClose: () => void;
  onSave: (shift: ShiftLog) => void | Promise<void>;
}) {
  const [time, setTime] = useState(nowHHMM());
  const [types, setTypes] = useState<SymptomType[]>(['drowsiness']);
  const [otherNote, setOtherNote] = useState('');
  const [intensity, setIntensity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [saving, setSaving] = useState(false);

  function toggleType(t: SymptomType) {
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  async function handleSave() {
    setSaving(true);
    const shift = attachSymptomToTodayShift(shifts, {
      id: newId(),
      time,
      types,
      otherNote: types.includes('other') && otherNote ? otherNote : undefined,
      intensity,
    });
    await onSave(shift);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-head">
          <h2 style={{ fontSize: 19 }}>症状を記録</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる" style={{ fontSize: 20 }}>
            ✕
          </button>
        </div>

        <div className="field">
          <span className="lbl">時刻</span>
          <input
            type="time"
            className="inp"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{ fontSize: 20, padding: '14px 12px' }}
          />
        </div>

        <div className="field">
          <span className="lbl">症状（複数選択可）</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {SYMPTOM_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`seg ${types.includes(t) ? 'on' : ''}`}
                onClick={() => toggleType(t)}
                style={{ fontSize: 15, padding: '14px 6px', fontWeight: 700 }}
              >
                {SYMPTOM_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          {types.includes('other') && (
            <input
              type="text"
              className="inp"
              value={otherNote}
              onChange={(e) => setOtherNote(e.target.value)}
              placeholder="症状を入力"
              style={{ marginTop: 8 }}
            />
          )}
        </div>

        <div className="field">
          <span className="lbl">強さ</span>
          <div className="segrow">
            {INTENSITIES.map((i) => (
              <button
                key={i}
                type="button"
                className={`seg ${intensity === i ? 'on' : ''}`}
                onClick={() => setIntensity(i)}
                aria-label={`強さ${i}`}
                style={{ fontSize: 22, padding: '16px 0' }}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || types.length === 0}
          style={{ fontSize: 18, padding: '20px 14px' }}
        >
          記録する
        </button>
      </div>
    </div>
  );
}
