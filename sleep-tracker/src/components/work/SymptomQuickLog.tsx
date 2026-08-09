import { useState } from 'react';
import type { CopingEffect, CopingMethod, ShiftLog, SymptomType } from '../../types/work';
import { COPING_EFFECT_LABELS, COPING_METHODS, COPING_METHOD_LABELS, SYMPTOM_TYPES, SYMPTOM_TYPE_LABELS } from '../../types/work';
import { attachCopingToSymptom, attachSymptomToTodayShift } from '../../lib/todayShift';
import { lastWorkingCopingFor } from '../../lib/workAnalysis';
import { newId } from '../../lib/id';

const INTENSITIES = [1, 2, 3, 4, 5] as const;

type Step = 'symptom' | 'blackout_warning' | 'coping';

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
  const [step, setStep] = useState<Step>('symptom');
  const [time, setTime] = useState(nowHHMM());
  const [types, setTypes] = useState<SymptomType[]>(['drowsiness']);
  const [otherNote, setOtherNote] = useState('');
  const [intensity, setIntensity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [saving, setSaving] = useState(false);

  const [pendingShift, setPendingShift] = useState<ShiftLog | null>(null);
  const [pendingSymptomId, setPendingSymptomId] = useState<string | null>(null);
  const [copingMethods, setCopingMethods] = useState<CopingMethod[]>([]);
  const [copingOtherNote, setCopingOtherNote] = useState('');
  const [copingEffect, setCopingEffect] = useState<CopingEffect>('unknown');

  function toggleType(t: SymptomType) {
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  function toggleCopingMethod(m: CopingMethod) {
    setCopingMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  async function handleSaveSymptom() {
    setSaving(true);
    const symptomId = newId();
    const updatedShift = attachSymptomToTodayShift(shifts, {
      id: symptomId,
      time,
      types,
      otherNote: types.includes('other') && otherNote ? otherNote : undefined,
      intensity,
    });
    await onSave(updatedShift);
    setPendingShift(updatedShift);
    setPendingSymptomId(symptomId);
    setSaving(false);
    setStep(types.includes('blackout') ? 'blackout_warning' : 'coping');
  }

  async function handleSaveCoping() {
    if (!pendingShift || !pendingSymptomId) {
      onClose();
      return;
    }
    setSaving(true);
    const finalShift = attachCopingToSymptom(pendingShift, pendingSymptomId, {
      methods: copingMethods,
      otherNote: copingMethods.includes('other') && copingOtherNote ? copingOtherNote : undefined,
      effect: copingEffect,
    });
    await onSave(finalShift);
    setSaving(false);
    onClose();
  }

  const hint = step === 'coping' ? lastWorkingCopingFor(shifts, types) : null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        {step === 'symptom' && (
          <>
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
              onClick={handleSaveSymptom}
              disabled={saving || types.length === 0}
              style={{ fontSize: 18, padding: '20px 14px' }}
            >
              記録する
            </button>
          </>
        )}

        {step === 'blackout_warning' && (
          <>
            <div className="modal-head">
              <h2 style={{ fontSize: 19, color: 'var(--moya)' }}>⚠ 少し休憩を</h2>
            </div>
            <div className="card" style={{ borderColor: 'var(--moya)' }}>
              <div style={{ fontSize: 15, lineHeight: 1.7 }}>
                「意識が飛ぶ感覚」が記録されました。安全のため、可能であれば施術を中断し、
                深呼吸や水分補給、少しの休憩を取ってください。無理は禁物です。
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setStep('coping')} style={{ fontSize: 16, padding: '16px' }}>
              了解、対処法を記録する
            </button>
            <button className="text-link" onClick={onClose}>
              今は記録しない
            </button>
          </>
        )}

        {step === 'coping' && (
          <>
            <div className="modal-head">
              <h2 style={{ fontSize: 18 }}>試した対処法（任意）</h2>
              <button className="icon-btn" onClick={onClose} aria-label="閉じる">
                ✕
              </button>
            </div>

            {hint && (
              <div className="subtle">💡 前回この症状のときは「{COPING_METHOD_LABELS[hint]}」が効きました</div>
            )}

            <div className="field">
              <span className="lbl">対処法（複数選択可）</span>
              <div className="pill-row">
                {COPING_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="pill"
                    style={
                      copingMethods.includes(m)
                        ? { borderColor: 'var(--nap)', color: 'var(--nap)', background: 'var(--nap-soft)' }
                        : undefined
                    }
                    onClick={() => toggleCopingMethod(m)}
                  >
                    {COPING_METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
              {copingMethods.includes('other') && (
                <input
                  type="text"
                  className="inp"
                  value={copingOtherNote}
                  onChange={(e) => setCopingOtherNote(e.target.value)}
                  placeholder="対処法を入力"
                  style={{ marginTop: 8 }}
                />
              )}
            </div>

            {copingMethods.length > 0 && (
              <div className="field">
                <span className="lbl">効果</span>
                <div className="segrow">
                  {(['worked', 'no_effect', 'unknown'] as CopingEffect[]).map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={`seg ${copingEffect === e ? 'on' : ''}`}
                      onClick={() => setCopingEffect(e)}
                    >
                      {COPING_EFFECT_LABELS[e]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="btn-row">
              <button className="btn btn-secondary" onClick={onClose}>
                スキップ
              </button>
              <button className="btn btn-primary" onClick={handleSaveCoping} disabled={saving}>
                保存
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
