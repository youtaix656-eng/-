import { useEffect, useRef, useState } from 'react';
import type { NapAfterState, SleepRecord } from '../types/sleep';
import { NAP_AFTER_STATE_LABELS } from '../types/sleep';
import { NAP_PRESETS_MIN } from '../types/napTimer';
import { clearNapTimer, loadNapTimer, saveNapTimer } from '../lib/storage';
import { isoToHHMM } from '../lib/time';
import { playAlarm } from '../lib/alarm';
import { attachNapToTodayRecord } from '../lib/todayRecord';
import { newId } from '../lib/id';

type View = 'select' | 'running' | 'done';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

export default function NapTimer({
  initialPreset,
  records,
  onSaveNap,
  onClose,
}: {
  initialPreset: number | null;
  records: SleepRecord[];
  onSaveNap: (record: SleepRecord) => void | Promise<void>;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>('select');
  const [durationMin, setDurationMin] = useState<number>(initialPreset ?? 20);
  const [customMin, setCustomMin] = useState('');
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [napStart, setNapStart] = useState('');
  const [napEnd, setNapEnd] = useState('');
  const [afterState, setAfterState] = useState<NapAfterState>('neutral');
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);
  const initializedFromPersisted = useRef(false);

  async function requestWakeLock() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };
      if (nav.wakeLock) {
        wakeLock.current = await nav.wakeLock.request('screen');
      }
    } catch {
      // 対応していない/許可されない環境は無視
    }
  }

  function releaseWakeLock() {
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }

  function finish(startedIso: string, endsIso: string) {
    releaseWakeLock();
    clearNapTimer();
    playAlarm();
    setNapStart(isoToHHMM(startedIso));
    setNapEnd(isoToHHMM(endsIso));
    setAfterState('neutral');
    setView('done');
  }

  async function start(min: number) {
    const now = Date.now();
    const startedIso = new Date(now).toISOString();
    const endsIso = new Date(now + min * 60000).toISOString();
    setDurationMin(min);
    setStartedAt(startedIso);
    setEndsAt(endsIso);
    setView('running');
    await saveNapTimer({ status: 'running', durationMin: min, startedAt: startedIso, endsAt: endsIso });
    requestWakeLock();
  }

  function cancelRunning() {
    releaseWakeLock();
    clearNapTimer();
    onClose();
  }

  async function handleSave() {
    const record = attachNapToTodayRecord(records, {
      id: newId(),
      start: napStart,
      end: napEnd,
      afterState,
    });
    await onSaveNap(record);
    onClose();
  }

  // 初回マウント時：進行中のタイマーがあれば復元、無ければプリセットで即開始
  useEffect(() => {
    if (initializedFromPersisted.current) return;
    initializedFromPersisted.current = true;
    (async () => {
      const persisted = await loadNapTimer();
      if (persisted && persisted.status === 'running' && persisted.startedAt && persisted.endsAt) {
        const endsMs = new Date(persisted.endsAt).getTime();
        if (Date.now() >= endsMs) {
          finish(persisted.startedAt, persisted.endsAt);
        } else {
          setDurationMin(persisted.durationMin);
          setStartedAt(persisted.startedAt);
          setEndsAt(persisted.endsAt);
          setView('running');
          requestWakeLock();
        }
        return;
      }
      if (initialPreset) {
        start(initialPreset);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 実行中のカウントダウン更新
  useEffect(() => {
    if (view !== 'running' || !endsAt || !startedAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000));
      setRemainingSec(remaining);
      if (remaining <= 0) {
        finish(startedAt, endsAt);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [view, endsAt, startedAt]);

  useEffect(() => releaseWakeLock, []);

  const totalSec = durationMin * 60;
  const progress = totalSec > 0 ? 1 - remainingSec / totalSec : 0;
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const ss = String(remainingSec % 60).padStart(2, '0');

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        {view === 'select' && (
          <>
            <div className="modal-head">
              <h2>仮眠タイマー</h2>
              <button className="icon-btn" onClick={onClose} aria-label="閉じる">
                ✕
              </button>
            </div>
            <div className="btn-row">
              {NAP_PRESETS_MIN.map((m) => (
                <button key={m} className="btn btn-primary" onClick={() => start(m)}>
                  {m}分
                </button>
              ))}
            </div>
            <div className="field-row">
              <div className="field">
                <span className="lbl">カスタム（分）</span>
                <input
                  type="number"
                  className="inp"
                  min={1}
                  max={180}
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  placeholder="例: 45"
                />
              </div>
              <button
                className="btn btn-secondary"
                style={{ alignSelf: 'flex-end' }}
                disabled={!customMin || Number(customMin) <= 0}
                onClick={() => start(Number(customMin))}
              >
                開始
              </button>
            </div>
          </>
        )}

        {view === 'running' && (
          <>
            <div className="modal-head">
              <h2>仮眠中…</h2>
              <button className="icon-btn" onClick={cancelRunning} aria-label="キャンセル">
                キャンセル
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <div
                style={{
                  width: 176,
                  height: 176,
                  borderRadius: '50%',
                  background: `conic-gradient(var(--text) ${progress * 360}deg, var(--border-soft) ${progress * 360}deg 360deg)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 142,
                    height: 142,
                    borderRadius: '50%',
                    background: 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                  }}
                >
                  <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {mm}:{ss}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>残り時間</span>
                </div>
              </div>
            </div>
            <div className="subtle" style={{ textAlign: 'center' }}>
              終了時にバイブ＋アラーム。終了と同時に「仮眠後の状態」入力へ。
            </div>
          </>
        )}

        {view === 'done' && (
          <>
            <div className="modal-head">
              <h2>お疲れさまでした</h2>
            </div>
            <div className="field-row">
              <div className="field">
                <span className="lbl">開始</span>
                <input type="time" className="inp" value={napStart} onChange={(e) => setNapStart(e.target.value)} />
              </div>
              <div className="field">
                <span className="lbl">終了</span>
                <input type="time" className="inp" value={napEnd} onChange={(e) => setNapEnd(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <span className="lbl">仮眠後の状態</span>
              <div className="pill-row">
                {(['groggy', 'neutral', 'refreshed'] as NapAfterState[]).map((s) => (
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
            <div className="btn-row">
              <button className="btn btn-secondary" onClick={onClose}>
                記録せず閉じる
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                記録を保存
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
