import { useState } from 'react';
import type { NapAfterState, SleepRecord } from '../types/sleep';
import { NAP_AFTER_STATE_LABELS } from '../types/sleep';
import { attachNapToTodayRecord } from '../lib/todayRecord';
import { newId } from '../lib/id';
import { addMinutesToTime, todayISODate } from '../lib/time';

const AFTER_STATES: NapAfterState[] = ['groggy', 'neutral', 'refreshed'];

function defaultStart(records: SleepRecord[]): string {
  const today = records.find((r) => r.date === todayISODate());
  const lastNap = today?.naps[today.naps.length - 1];
  if (lastNap) return lastNap.end;
  if (today?.coreSleep.end) return today.coreSleep.end;
  return '';
}

export default function NapQuickAdd({
  records,
  onClose,
  onSave,
}: {
  records: SleepRecord[];
  onClose: () => void;
  onSave: (record: SleepRecord) => void | Promise<void>;
}) {
  const [start, setStart] = useState(defaultStart(records));
  const [end, setEnd] = useState(addMinutesToTime(defaultStart(records), 20));
  const [afterState, setAfterState] = useState<NapAfterState>('neutral');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const record = attachNapToTodayRecord(records, { id: newId(), start, end, afterState }, memo);
    await onSave(record);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-head">
          <h2>仮眠を後から記録</h2>
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
          <span className="lbl">仮眠後の状態</span>
          <div className="pill-row">
            {AFTER_STATES.map((s) => (
              <button
                key={s}
                type="button"
                className="pill"
                style={
                  afterState === s
                    ? { borderColor: 'var(--nap)', color: 'var(--nap)', background: 'var(--nap-soft)' }
                    : undefined
                }
                onClick={() => setAfterState(s)}
              >
                {NAP_AFTER_STATE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="lbl">一言メモ（任意）</span>
          <textarea className="inp" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="気になったことがあれば" />
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
