import { useEffect, useState } from 'react';
import type { GrogginessPeriod, Nap, NapAfterState, SleepRecord, StudyPerformance, WakeState } from '../types/sleep';
import { NAP_AFTER_STATE_LABELS, WAKE_STATE_EMOJI, WAKE_STATE_LABELS } from '../types/sleep';
import { computeTotalSleepHours } from '../lib/calc';
import { newId } from '../lib/id';
import { loadLastDefaults } from '../lib/storage';
import { addMinutesToTime, todayISODate } from '../lib/time';

const WAKE_STATES: WakeState[] = [1, 2, 3, 4, 5];
const AFTER_STATES: NapAfterState[] = ['groggy', 'neutral', 'refreshed'];
const INTENSITIES = [1, 2, 3, 4, 5] as const;

export default function RecordForm({
  initial,
  defaultDate,
  onClose,
  onSave,
}: {
  initial: SleepRecord | null;
  defaultDate?: string;
  onClose: () => void;
  onSave: (record: SleepRecord) => void | Promise<void>;
}) {
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? todayISODate());
  const [coreStart, setCoreStart] = useState(initial?.coreSleep.start ?? '');
  const [coreEnd, setCoreEnd] = useState(initial?.coreSleep.end ?? '');
  const [wakeState, setWakeState] = useState<WakeState>(initial?.wakeState ?? 3);
  const [naps, setNaps] = useState<Nap[]>(initial?.naps ?? []);
  const [groggy, setGroggy] = useState<GrogginessPeriod[]>(initial?.grogginessPeriods ?? []);
  const [studyPerformance, setStudyPerformance] = useState<StudyPerformance>(initial?.studyPerformance ?? 3);
  const [workEndTime, setWorkEndTime] = useState(initial?.workEndTime ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [saving, setSaving] = useState(false);

  // 新規記録では、前回のコア睡眠開始・勤務終了時刻を覚えておいて初期値にする
  useEffect(() => {
    if (initial) return;
    loadLastDefaults().then((d) => {
      if (d.coreSleep?.start) setCoreStart((cur) => cur || d.coreSleep!.start);
      if (d.workEndTime) setWorkEndTime((cur) => cur || d.workEndTime!);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalHours = computeTotalSleepHours({ start: coreStart, end: coreEnd }, naps);

  function addNap() {
    const start = naps.length > 0 ? naps[naps.length - 1].end : coreEnd || '12:00';
    setNaps([...naps, { id: newId(), start, end: addMinutesToTime(start, 20), afterState: 'neutral' }]);
  }

  function updateNap(id: string, patch: Partial<Nap>) {
    setNaps(naps.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function removeNap(id: string) {
    setNaps(naps.filter((n) => n.id !== id));
  }

  function addGroggy() {
    setGroggy([...groggy, { id: newId(), start: '13:00', end: '14:00', intensity: 3 }]);
  }

  function updateGroggy(id: string, patch: Partial<GrogginessPeriod>) {
    setGroggy(groggy.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function removeGroggy(id: string) {
    setGroggy(groggy.filter((g) => g.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    const now = new Date().toISOString();
    const record: SleepRecord = {
      id: initial?.id ?? newId(),
      date,
      coreSleep: { start: coreStart, end: coreEnd },
      wakeState,
      naps,
      grogginessPeriods: groggy,
      totalSleepHours: totalHours,
      studyPerformance,
      workEndTime: workEndTime || undefined,
      memo,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    await onSave(record);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-head">
          <h2>{initial ? '記録を編集' : '記録を入力'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="field">
          <span className="lbl">日付</span>
          <input type="date" className="inp" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field">
          <span className="lbl">コア睡眠</span>
          <div className="field-row">
            <div className="field">
              <span className="lbl">開始</span>
              <input type="time" className="inp" value={coreStart} onChange={(e) => setCoreStart(e.target.value)} />
            </div>
            <div className="field">
              <span className="lbl">終了</span>
              <input type="time" className="inp" value={coreEnd} onChange={(e) => setCoreEnd(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="field">
          <span className="lbl">起床直後の状態</span>
          <div className="segrow">
            {WAKE_STATES.map((w) => (
              <button
                key={w}
                type="button"
                className={`seg ${wakeState === w ? 'on' : ''}`}
                onClick={() => setWakeState(w)}
                aria-label={WAKE_STATE_LABELS[w]}
              >
                {WAKE_STATE_EMOJI[w]}
                <span className="n">{WAKE_STATE_LABELS[w]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="section-title">
            <span>仮眠</span>
          </div>
          {naps.map((n) => (
            <div className="card" key={n.id} style={{ padding: '10px 12px' }}>
              <div className="field-row">
                <div className="field">
                  <span className="lbl">開始</span>
                  <input type="time" className="inp" value={n.start} onChange={(e) => updateNap(n.id, { start: e.target.value })} />
                </div>
                <div className="field">
                  <span className="lbl">終了</span>
                  <input type="time" className="inp" value={n.end} onChange={(e) => updateNap(n.id, { end: e.target.value })} />
                </div>
              </div>
              <div className="pill-row" style={{ marginTop: 8 }}>
                {AFTER_STATES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="pill"
                    style={
                      n.afterState === s
                        ? { borderColor: 'var(--nap)', color: 'var(--nap)', background: 'var(--nap-soft)' }
                        : undefined
                    }
                    onClick={() => updateNap(n.id, { afterState: s })}
                  >
                    {NAP_AFTER_STATE_LABELS[s]}
                  </button>
                ))}
                <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => removeNap(n.id)}>
                  削除
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={addNap} style={{ padding: 9 }}>
            ＋ 仮眠を追加
          </button>
        </div>

        <div className="field">
          <div className="section-title">
            <span>モヤ（眠気）が出た時間帯</span>
          </div>
          {groggy.map((g) => (
            <div className="card" key={g.id} style={{ padding: '10px 12px' }}>
              <div className="field-row">
                <div className="field">
                  <span className="lbl">開始</span>
                  <input type="time" className="inp" value={g.start} onChange={(e) => updateGroggy(g.id, { start: e.target.value })} />
                </div>
                <div className="field">
                  <span className="lbl">終了</span>
                  <input type="time" className="inp" value={g.end} onChange={(e) => updateGroggy(g.id, { end: e.target.value })} />
                </div>
              </div>
              <div className="pill-row" style={{ marginTop: 8, alignItems: 'center' }}>
                <span className="subtle" style={{ fontSize: 12 }}>
                  強さ
                </span>
                {INTENSITIES.map((i) => (
                  <button
                    key={i}
                    type="button"
                    className="pill"
                    style={
                      g.intensity === i
                        ? { borderColor: 'var(--moya)', color: 'var(--moya)', background: 'var(--moya-soft)' }
                        : undefined
                    }
                    onClick={() => updateGroggy(g.id, { intensity: i })}
                  >
                    {i}
                  </button>
                ))}
                <button type="button" className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => removeGroggy(g.id)}>
                  削除
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={addGroggy} style={{ padding: 9 }}>
            ＋ モヤの時間帯を追加
          </button>
        </div>

        <div className="card">
          <div className="card-label">合計睡眠時間（自動計算）</div>
          <div className="big-num" style={{ fontSize: 22 }}>
            {totalHours}
            <span className="unit">h</span>
          </div>
        </div>

        <div className="field">
          <span className="lbl">学習パフォーマンス</span>
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
          <span className="lbl">勤務終了時刻（任意・提案機能に使用）</span>
          <input type="time" className="inp" value={workEndTime} onChange={(e) => setWorkEndTime(e.target.value)} />
        </div>

        <div className="field">
          <span className="lbl">メモ</span>
          <textarea className="inp" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="気づいたことを自由に" />
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
