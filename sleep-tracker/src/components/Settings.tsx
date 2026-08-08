import { useRef, useState } from 'react';
import type { AppSettings } from '../types/settings';
import type { BackupFile } from '../lib/storage';
import { exportBackup, importBackup } from '../lib/storage';
import { requestNotificationPermission } from '../lib/reminders';

export default function Settings({
  settings,
  onUpdateSettings,
  onImported,
  onClose,
}: {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onImported: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [targetInput, setTargetInput] = useState(String(settings.targetWeeklyHours ?? ''));
  const [status, setStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sleep-tracker-backup-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('書き出しました');
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupFile;
      const count = await importBackup(data);
      await onImported();
      setStatus(`${count}件の記録を取り込みました`);
    } catch (err) {
      setStatus('取り込みに失敗しました（ファイルを確認してください）');
      console.warn('import failed', err);
    }
  }

  function handleSaveGoal() {
    const n = Number(targetInput);
    onUpdateSettings({ targetWeeklyHours: Number.isFinite(n) && n > 0 ? n : undefined });
    setStatus('保存しました');
  }

  async function handleToggleReminders() {
    const next = !settings.remindersEnabled;
    if (next) {
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') {
        setStatus('通知が許可されませんでした（端末の設定から許可できます）');
        onUpdateSettings({ remindersEnabled: false });
        return;
      }
    }
    onUpdateSettings({ remindersEnabled: next });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-sheet">
        <div className="modal-head">
          <h2>設定</h2>
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="field">
          <span className="lbl">週の目標睡眠時間（時間）</span>
          <div className="field-row">
            <input
              type="number"
              className="inp"
              min={1}
              max={80}
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="例: 28"
            />
            <button className="btn btn-secondary" style={{ flex: 'none' }} onClick={handleSaveGoal}>
              保存
            </button>
          </div>
        </div>

        <div className="field">
          <span className="lbl">未記録リマインダー</span>
          <button className="btn btn-secondary" onClick={handleToggleReminders}>
            {settings.remindersEnabled ? '通知オン（タップでオフ）' : '通知オフ（タップでオン）'}
          </button>
          <span className="subtle">アプリを開いている間だけ、夕方以降に今日未記録なら通知します。</span>
        </div>

        <div className="field">
          <span className="lbl">バックアップ</span>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={handleExport}>
              書き出し（JSON）
            </button>
            <button className="btn btn-secondary" onClick={handleImportClick}>
              取り込み
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
          <span className="subtle">記録はこの端末にのみ保存されています。機種変更前などにバックアップをおすすめします。</span>
        </div>

        {status && <div className="card">{status}</div>}
      </div>
    </div>
  );
}
