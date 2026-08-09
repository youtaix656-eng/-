import { useState } from 'react';
import type { CaffeineIntake, ShiftLog, VentilationStatus } from '../../types/work';
import { VENTILATION_LABELS } from '../../types/work';
import type { SleepRecord } from '../../types/sleep';
import { applyShiftStart, derivePriorSleepFromRecords, findTodayShift } from '../../lib/todayShift';
import { formatDateLabel, todayISODate } from '../../lib/time';

const VENTILATIONS: VentilationStatus[] = ['normal', 'broken', 'unknown'];

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ShiftStartForm({
  shifts,
  records,
  onClose,
  onSave,
}: {
  shifts: ShiftLog[];
  records: SleepRecord[];
  onClose: () => void;
  onSave: (shift: ShiftLog) => void | Promise<void>;
}) {
  const derived = derivePriorSleepFromRecords(records);
  const existing = findTodayShift(shifts);

  const [startTime, setStartTime] = useState(existing?.startTime || nowHHMM());
  const [ventilation, setVentilation] = useState<VentilationStatus>(existing?.ventilation ?? 'unknown');
  const [priorSleepAuto, setPriorSleepAuto] = useState(existing ? existing.priorSleepAuto : derived.hours !== undefined);
  const [priorSleepHours, setPriorSleepHours] = useState(String(existing?.priorSleepHours ?? derived.hours ?? ''));
  const [caffeineTaken, setCaffeineTaken] = useState(existing?.caffeine.taken ?? false);
  const [caffeineTime, setCaffeineTime] = useState(existing?.caffeine.time || nowHHMM());
  const [caffeineAmount, setCaffeineAmount] = useState(existing?.caffeine.amount ?? '');
  const [tookBreaks, setTookBreaks] = useState<boolean | undefined>(existing?.tookBreaks);
  const [continuousHours, setContinuousHours] = useState(String(existing?.continuousTreatmentHours ?? ''));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const caffeine: CaffeineIntake = caffeineTaken
      ? { taken: true, time: caffeineTime, amount: caffeineAmount || undefined }
      : { taken: false };
    const shift = applyShiftStart(shifts, {
      startTime,
      ventilation,
      priorSleepHours: priorSleepAuto ? derived.hours : Number(priorSleepHours) || undefined,
      priorSleepAuto,
      priorSleepPattern: priorSleepAuto ? derived.pattern : undefined,
      caffeine,
      tookBreaks,
      continuousTreatmentHours: Number(continuousHours) || undefined,
    });
    await onSave(shift);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-head">
          <div>
            <h2>勤務を{existing?.startTime ? '編集' : '開始'}</h2>
            <div className="subtle" style={{ marginTop: 2 }}>
              {formatDateLabel(todayISODate())}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="field">
          <span className="lbl">勤務開始時刻</span>
          <input type="time" className="inp" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>

        <div className="field">
          <span className="lbl">換気扇の状態</span>
          <div className="segrow">
            {VENTILATIONS.map((v) => (
              <button
                key={v}
                type="button"
                className={`seg ${ventilation === v ? 'on' : ''}`}
                onClick={() => setVentilation(v)}
              >
                {VENTILATION_LABELS[v]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="lbl">前夜の睡眠</span>
          {priorSleepAuto && derived.hours !== undefined ? (
            <div className="card" style={{ padding: '10px 12px' }}>
              <div className="pill-row">
                <span className="pill" style={{ borderColor: 'var(--sleep)', color: 'var(--sleep)' }}>
                  {derived.hours}h
                </span>
                {derived.pattern && (
                  <span className="pill">
                    {derived.pattern.start}–{derived.pattern.end}
                  </span>
                )}
                <span className="subtle" style={{ marginLeft: 'auto' }}>
                  睡眠記録から自動取得
                </span>
              </div>
              <button className="text-link" onClick={() => setPriorSleepAuto(false)}>
                手入力に切り替える
              </button>
            </div>
          ) : (
            <>
              <input
                type="number"
                className="inp"
                min={0}
                max={24}
                step={0.5}
                value={priorSleepHours}
                onChange={(e) => setPriorSleepHours(e.target.value)}
                placeholder="例: 3.5"
              />
              {derived.hours !== undefined && (
                <button className="text-link" onClick={() => setPriorSleepAuto(true)}>
                  睡眠記録の値（{derived.hours}h）を使う
                </button>
              )}
            </>
          )}
        </div>

        <div className="field">
          <span className="lbl">カフェイン摂取</span>
          <div className="segrow">
            <button type="button" className={`seg ${!caffeineTaken ? 'on' : ''}`} onClick={() => setCaffeineTaken(false)}>
              なし
            </button>
            <button type="button" className={`seg ${caffeineTaken ? 'on' : ''}`} onClick={() => setCaffeineTaken(true)}>
              あり
            </button>
          </div>
          {caffeineTaken && (
            <div className="field-row" style={{ marginTop: 8 }}>
              <div className="field">
                <span className="lbl">時刻</span>
                <input type="time" className="inp" value={caffeineTime} onChange={(e) => setCaffeineTime(e.target.value)} />
              </div>
              <div className="field">
                <span className="lbl">量（任意）</span>
                <input
                  type="text"
                  className="inp"
                  value={caffeineAmount}
                  onChange={(e) => setCaffeineAmount(e.target.value)}
                  placeholder="例: コーヒー1杯"
                />
              </div>
            </div>
          )}
        </div>

        <div className="field">
          <span className="lbl">休憩（任意）</span>
          <div className="segrow">
            <button type="button" className={`seg ${tookBreaks === true ? 'on' : ''}`} onClick={() => setTookBreaks(true)}>
              取れた
            </button>
            <button type="button" className={`seg ${tookBreaks === false ? 'on' : ''}`} onClick={() => setTookBreaks(false)}>
              取れなかった
            </button>
          </div>
        </div>

        <div className="field">
          <span className="lbl">連続施術時間の目安（時間・任意）</span>
          <input
            type="number"
            className="inp"
            min={0}
            max={12}
            step={0.5}
            value={continuousHours}
            onChange={(e) => setContinuousHours(e.target.value)}
            placeholder="例: 3"
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
