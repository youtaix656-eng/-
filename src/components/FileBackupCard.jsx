import { useRef, useState } from 'react';
import { exportAll, flushNow } from '../lib/storage.js';
import { downloadFile, browserDownload, backupFileName } from '../lib/download.js';
import { canNativeSaveFile, nativeShareTextFile, canNativePickFile, nativePickTextFile } from '../lib/nativeBridge.js';
import { parseBackupText } from '../lib/backupText.js';

// 全データ（問題・進捗・メモ・設定）のバックアップファイルによる保存・共有・復元。
// Settings.jsx（設定画面）・MigrationGuide.jsx（機種変更ガイド）で共用する。
// アプリ版（Android の WebView）では <a download> と navigator.share が効かないので、
// 保存・共有はネイティブ側（android/ の BackupFilePlugin.kt）に任せる。
export default function FileBackupCard({ settings, updateSettings, markBackedUp, importBackup, onToast }) {
  const backupRef = useRef(null);
  const [busy, setBusy] = useState(false);
  // 最後に何が起きたかを画面に残す（トーストはすぐ消えるので、うまくいかなかった時に見返せるように）
  const [status, setStatus] = useState(null); // { ok, text }
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const native = canNativeSaveFile();
  const nativePick = canNativePickFile();
  const report = (ok, text) => {
    setStatus({ ok, text });
    onToast(text);
  };
  // 種類で絞りすぎると、LINE・ドライブ経由や「.json.txt」になったファイルが灰色になって選べない。
  // アプリ版では絞らない。

  // バックアップの中身（JSON文字列とファイル名）を作る（保存・共有で共用）
  const buildBackupFile = async () => {
    const data = await exportAll();
    return { content: JSON.stringify(data), filename: backupFileName() };
  };

  const backupAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { content, filename } = await buildBackupFile();
      const r = await downloadFile(content, filename, 'application/json');
      if (!r.ok) {
        report(false, `保存できませんでした（${r.error}）。「📤 共有」から Googleドライブ等へ送ってください`);
        return;
      }
      markBackedUp();
      report(true, r.native
        ? `「${r.location}」フォルダに ${filename} を保存しました`
        : `${filename} を保存しました（ダウンロードを確認してください）`);
    } catch (e) {
      report(false, `保存できませんでした（${(e && e.message) || '不明なエラー'}）`);
    } finally {
      setBusy(false);
    }
  };

  // 対応端末では共有シート（AirDrop/LINE/Google Drive等）へ直接渡す。
  // 非対応（Web Share APIやファイル共有に未対応のブラウザ）は通常のダウンロードにフォールバック。
  const hasShareApi = typeof navigator !== 'undefined' && !!navigator.share;
  const canShare = native || hasShareApi;
  const shareBackup = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { content, filename } = await buildBackupFile();
      if (native) {
        await nativeShareTextFile(content, filename, 'application/json');
        markBackedUp();
        setStatus({ ok: true, text: `共有の画面を開きました（${filename}）。送り先を選んでください` });
        return;
      }
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
      browserDownload(content, filename, 'application/json');
      markBackedUp();
      onToast('この端末は共有に未対応のため、ダウンロードしました');
    } catch (e) {
      report(false, `共有できませんでした（${(e && e.message) || '不明なエラー'}）`);
    } finally {
      setBusy(false);
    }
  };

  // 読み込んだ文字からの復元（ファイル選択・ネイティブの選択・貼り付けで共用）
  const restoreFromText = async (text, from) => {
    let data;
    try {
      data = parseBackupText(text);
    } catch (err) {
      report(false, `復元できませんでした（${from}）：${err.message}`);
      return false;
    }
    const when = data.exportedAt ? new Date(data.exportedAt).toLocaleString('ja-JP') : '日時不明';
    const n = Array.isArray(data.history) ? data.history.length : 0;
    if (!confirm(`${when} のバックアップ（解答記録 ${n} 件）で、今の学習データを上書きします。よろしいですか？`)) {
      setStatus({ ok: false, text: '復元をやめました（何も変わっていません）' });
      return false;
    }
    setBusy(true);
    try {
      await importBackup(data);
      await flushNow();
      report(true, `復元しました（解答記録 ${n} 件）。画面を読み込み直します…`);
      // 画面ごとに読み込んだ記録（誤答理由・再生履歴など）も確実に入れ替えるため、読み込み直す
      setTimeout(() => { try { window.location.reload(); } catch (e2) { /* noop */ } }, 1500);
      return true;
    } catch (err) {
      report(false, `復元の途中で失敗しました（${(err && err.message) || '不明なエラー'}）`);
      setBusy(false);
      return false;
    }
  };

  const restoreAll = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
      setStatus({ ok: false, text: 'ファイルが選ばれませんでした' });
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch (err) {
      report(false, `ファイルを読めませんでした（${(err && err.message) || '不明なエラー'}）`);
      return;
    }
    await restoreFromText(text, file.name || 'ファイル');
  };

  // 復元ボタン：アプリ版はネイティブのファイル選択（WebView の <input type="file"> を通さない）。
  // 使えない時・失敗した時は従来の選択画面へ落とす。
  const startRestore = async () => {
    if (busy) return;
    setStatus(null);
    if (nativePick) {
      try {
        const r = await nativePickTextFile();
        if (!r || r.canceled) {
          setStatus({ ok: false, text: 'ファイルの選択をやめました' });
          return;
        }
        await restoreFromText(r.content || '', r.name || 'ファイル');
        return;
      } catch (err) {
        setStatus({ ok: false, text: `アプリのファイル選択が使えませんでした（${(err && err.message) || '不明なエラー'}）。別の方法で開きます…` });
      }
    }
    backupRef.current?.click();
  };

  const restoreFromPaste = async () => {
    if (!pasteText.trim()) {
      setStatus({ ok: false, text: '貼り付け欄が空です' });
      return;
    }
    const ok = await restoreFromText(pasteText, '貼り付け');
    if (ok) setPasteText('');
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginBottom: 10 }}>
        問題・学習進捗・メモ・設定をまとめて1つのファイルに書き出せます。
        別の端末で「復元」すれば、そのまま学習を引き継げます（クラウド保存やUSB、
        Google Drive 等のファイル共有経由で持ち運べます）。
        {native
          ? '「保存」は端末の「ダウンロード」フォルダへ、「共有」は Googleドライブ・LINE・メール等へ送れます。'
          : hasShareApi && '「共有」を使うとAirDropやLINEなどの共有シートへ直接渡せます。'}
      </p>
      <div className="btn-row">
        <button className="btn primary" onClick={backupAll} disabled={busy}>
          💾 バックアップを保存
        </button>
        {canShare && (
          <button className="btn" onClick={shareBackup} disabled={busy}>
            📤 共有
          </button>
        )}
        <button className="btn" onClick={startRestore} disabled={busy}>
          復元（読み込み）
        </button>
      </div>
      {status && (
        <p className="inline-note" role="status" style={{ marginTop: 10, color: status.ok ? 'var(--correct, inherit)' : 'var(--warn, inherit)' }}>
          {status.ok ? '✅ ' : '⚠️ '}{status.text}
        </p>
      )}
      <button
        className="btn"
        style={{ marginTop: 10 }}
        onClick={() => setPasteOpen((v) => !v)}
        disabled={busy}
      >
        {pasteOpen ? '貼り付けて復元を閉じる' : 'ファイルが選べない時：中身を貼り付けて復元'}
      </button>
      {pasteOpen && (
        <div style={{ marginTop: 8 }}>
          <p className="inline-note">
            バックアップのファイル（.json）をメモ帳・ファイルアプリ等で開き、中身を全部コピーして下に貼り付けてください。
          </p>
          <textarea
            aria-label="バックアップの中身"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            style={{ width: '100%', boxSizing: 'border-box' }}
            placeholder='{"version":…'
          />
          <button className="btn" style={{ marginTop: 6 }} onClick={restoreFromPaste} disabled={busy}>
            貼り付けた内容で復元
          </button>
        </div>
      )}
      <input
        ref={backupRef}
        type="file"
        accept={native ? undefined : 'application/json,.json,text/plain,.txt'}
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
