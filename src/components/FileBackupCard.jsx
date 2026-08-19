import { useRef } from 'react';
import { exportAll } from '../lib/storage.js';

// 全データ（問題・進捗・メモ・設定）のバックアップファイルによる保存・共有・復元。
// Settings.jsx（設定画面）・MigrationGuide.jsx（機種変更ガイド）で共用する。
export default function FileBackupCard({ settings, updateSettings, markBackedUp, importBackup, onToast }) {
  const backupRef = useRef(null);

  const download = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // バックアップの中身（JSON文字列とファイル名）を作る（保存・共有で共用）
  const buildBackupFile = async () => {
    const data = await exportAll();
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `shinkyu_backup_${stamp}.json`;
    const content = JSON.stringify(data, null, 2);
    return { content, filename };
  };

  const backupAll = async () => {
    const { content, filename } = await buildBackupFile();
    download(content, filename, 'application/json');
    markBackedUp();
    onToast('バックアップを書き出しました');
  };

  // 対応端末では共有シート（AirDrop/LINE/Google Drive等）へ直接渡す。
  // 非対応（Web Share APIやファイル共有に未対応のブラウザ）は通常のダウンロードにフォールバック。
  const hasShareApi = typeof navigator !== 'undefined' && !!navigator.share;
  const shareBackup = async () => {
    const { content, filename } = await buildBackupFile();
    if (hasShareApi) {
      const file = new File([content], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: '鍼灸国試 対策アプリ バックアップ',
            text: '学習データのバックアップです。別の端末の「復元」で読み込めます。',
          });
          markBackedUp();
          onToast('共有しました');
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return; // ユーザーが共有をキャンセル
          // それ以外の失敗はダウンロードにフォールバック
        }
      }
    }
    download(content, filename, 'application/json');
    markBackedUp();
    onToast('この端末は共有に未対応のため、ダウンロードしました');
  };

  const restoreAll = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!confirm('現在の学習データをバックアップの内容で上書きします。よろしいですか？')) return;
    try {
      const data = JSON.parse(await file.text());
      await importBackup(data);
      onToast('バックアップから復元しました');
    } catch (err) {
      onToast('復元に失敗しました（ファイル形式をご確認ください）');
    }
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginBottom: 10 }}>
        問題・学習進捗・メモ・設定をまとめて1つのファイルに書き出せます。
        別の端末で「復元」すれば、そのまま学習を引き継げます（クラウド保存やUSB、
        Google Drive 等のファイル共有経由で持ち運べます）。
        {hasShareApi && '「共有」を使うとAirDropやLINEなどの共有シートへ直接渡せます。'}
      </p>
      <div className="btn-row">
        <button className="btn primary" onClick={backupAll}>
          💾 バックアップを保存
        </button>
        {hasShareApi && (
          <button className="btn" onClick={shareBackup}>
            📤 共有
          </button>
        )}
        <button className="btn" onClick={() => backupRef.current?.click()}>
          復元（読み込み）
        </button>
      </div>
      <input
        ref={backupRef}
        type="file"
        accept="application/json,.json"
        onChange={restoreAll}
        style={{ display: 'none' }}
      />

      <label className="switch-row" style={{ marginTop: 14 }}>
        <input
          type="checkbox"
          checked={settings.autoBackupOnStart}
          onChange={(e) => updateSettings({ autoBackupOnStart: e.target.checked })}
        />
        <span>
          起動時に自動バックアップ
          <small>1日1回まで、アプリを開いた時にバックアップを自動保存します。</small>
        </span>
      </label>
    </div>
  );
}
