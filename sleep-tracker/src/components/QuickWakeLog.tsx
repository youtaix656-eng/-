import { useEffect, useState } from 'react';
import type { SleepRecord, WakeState } from '../types/sleep';
import { applyQuickWakeLog } from '../lib/todayRecord';
import { loadLastDefaults } from '../lib/storage';
import { todayISODate } from '../lib/time';

const MOOD_OPTIONS: { value: WakeState; emoji: string; label: string }[] = [
  { value: 1, emoji: '😩', label: 'だるい' },
  { value: 3, emoji: '😐', label: 'ふつう' },
  { value: 5, emoji: '😄', label: '冴えていた' },
];

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function QuickWakeLog({
  records,
  onClose,
  onSave,
}: {
  records: SleepRecord[];
  onClose: () => void;
  onSave: (record: SleepRecord) => void | Promise<void>;
}) {
  const today = records.find((r) => r.date === todayISODate());
  const [coreStart, setCoreStart] = useState(today?.coreSleep.start ?? '');
  const [coreEnd, setCoreEnd] = useState(today?.coreSleep.end ?? nowHHMM());
  const [wakeState, setWakeState] = useState<WakeState>(today?.wakeState ?? 3);
  const [saving, setSaving] = useState(false);

  // 未入力なら前回のコア睡眠開始時刻を初期値にして、入力の手間を減らす
  useEffect(() => {
    if (today?.coreSleep.start) return;
    loadLastDefaults().then((d) => {
      if (d.coreSleep?.start) setCoreStart((cur) => cur || d.coreSleep!.start);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setSaving(true);
    const record = applyQuickWakeLog(records, { coreStart, coreEnd, wakeState });
    await onSave(record);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-head">
          <h2>おはようございます</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="field-row">
          <div className="field">
            <span className="lbl">就寝時刻</span>
            <input type="time" className="inp" value={coreStart} onChange={(e) => setCoreStart(e.target.value)} />
          </div>
          <div className="field">
            <span className="lbl">起床時刻</span>
            <input type="time" className="inp" value={coreEnd} onChange={(e) => setCoreEnd(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <span className="lbl">今の気分</span>
          <div className="segrow">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`seg ${wakeState === m.value ? 'on' : ''}`}
                onClick={() => setWakeState(m.value)}
                aria-label={m.label}
              >
                {m.emoji}
                <span className="n">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="subtle">仮眠やモヤ、学習の記録は後からいつでも追加できます。</div>

        <div className="btn-row">
          <button className="btn btn-secondary" onClick={onClose}>
            あとで
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
