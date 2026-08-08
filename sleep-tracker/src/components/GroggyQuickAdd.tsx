import { useState } from 'react';
import type { GroggyTrigger, SleepRecord } from '../types/sleep';
import { GROGGY_TRIGGER_LABELS, GROGGY_TRIGGERS } from '../types/sleep';
import { attachGroggyToTodayRecord } from '../lib/todayRecord';
import { newId } from '../lib/id';
import { addMinutesToTime } from '../lib/time';

const INTENSITIES = [1, 2, 3, 4, 5] as const;

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function GroggyQuickAdd({
  records,
  onClose,
  onSave,
}: {
  records: SleepRecord[];
  onClose: () => void;
  onSave: (record: SleepRecord) => void | Promise<void>;
}) {
  const [start, setStart] = useState(nowHHMM());
  const [end, setEnd] = useState(addMinutesToTime(nowHHMM(), 30));
  const [intensity, setIntensity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [triggers, setTriggers] = useState<GroggyTrigger[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleTrigger(t: GroggyTrigger) {
    setTriggers((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  async function handleSave() {
    setSaving(true);
    const record = attachGroggyToTodayRecord(records, {
      id: newId(),
      start,
      end,
      intensity,
      triggers: triggers.length > 0 ? triggers : undefined,
    });
    await onSave(record);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-head">
          <h2>モヤを記録</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="field-row">
          <div className="field">
            <span className="lbl">開始</span>
            <input type="time" className="inp" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <span className="lbl">終了</span>
            <input type="time" className="inp" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
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
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="lbl">きっかけ（複数選択可・任意）</span>
          <div className="pill-row">
            {GROGGY_TRIGGERS.map((t) => (
              <button
                key={t}
                type="button"
                className="pill"
                style={
                  triggers.includes(t)
                    ? { borderColor: 'var(--moya)', color: 'var(--moya)', background: 'var(--moya-soft)' }
                    : undefined
                }
                onClick={() => toggleTrigger(t)}
              >
                {GROGGY_TRIGGER_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="btn-row">
          <button className="btn btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !start || !end}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
