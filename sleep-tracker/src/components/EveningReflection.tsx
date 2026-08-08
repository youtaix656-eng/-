import { useState } from 'react';
import type { SleepRecord, StudyPerformance } from '../types/sleep';
import { applyEveningReflection } from '../lib/todayRecord';
import { formatDateLabel, todayISODate } from '../lib/time';

export default function EveningReflection({
  records,
  onClose,
  onSave,
}: {
  records: SleepRecord[];
  onClose: () => void;
  onSave: (record: SleepRecord) => void | Promise<void>;
}) {
  const today = records.find((r) => r.date === todayISODate());
  const [studyPerformance, setStudyPerformance] = useState<StudyPerformance>(today?.studyPerformance ?? 3);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const record = applyEveningReflection(records, { studyPerformance, memo });
    await onSave(record);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-head">
          <div>
            <h2>今日の振り返り</h2>
            <div className="subtle" style={{ marginTop: 2 }}>
              {formatDateLabel(todayISODate())}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="field">
          <span className="lbl">今日の学習パフォーマンス</span>
          <div className="segrow">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                className={`seg ${studyPerformance === v ? 'on' : ''}`}
                onClick={() => setStudyPerformance(v as StudyPerformance)}
                aria-label={`${v}点`}
              >
                {studyPerformance >= v ? '★' : '☆'}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="lbl">一言メモ（任意）</span>
          <textarea
            className="inp"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="今日気づいたことを一言"
          />
        </div>

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
