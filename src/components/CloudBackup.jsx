import { useState } from 'react';
import { exportAll } from '../lib/storage.js';
import {
  requestAccessToken,
  uploadBackup,
  downloadBackup,
  signOut,
  hasSession,
} from '../lib/googleDrive.js';

// Googleドライブ（アプリ専用のappDataFolダー・ユーザーには見えない領域）への
// クラウドバックアップ。他の機能と違いGoogleのサーバーと通信するため、
// 既定ではオフ（クライアントID未設定の間は何も送信しない）で、注記も明示する。
export default function CloudBackup({ settings, updateSettings, onToast, importBackup, cloudSyncStatus }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [lastSync, setLastSync] = useState(settings.googleDriveLastSync || null);
  const clientId = settings.googleDriveClientId || '';

  const ensureToken = async () => {
    const token = await requestAccessToken(clientId);
    setSignedIn(true);
    return token;
  };

  const doUpload = async () => {
    if (!clientId.trim()) { onToast?.('先にOAuthクライアントIDを設定してください'); return; }
    setBusy(true);
    try {
      const token = await ensureToken();
      const data = await exportAll();
      await uploadBackup(token, JSON.stringify(data));
      const now = Date.now();
      setLastSync(now);
      updateSettings({ googleDriveLastSync: now });
      onToast?.('Googleドライブへバックアップを保存しました');
    } catch (e) {
      onToast?.(e.message || 'Googleドライブへの保存に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    if (!clientId.trim()) { onToast?.('先にOAuthクライアントIDを設定してください'); return; }
    if (!confirm('現在の学習データをGoogleドライブ上のバックアップで上書きします。よろしいですか？')) return;
    setBusy(true);
    try {
      const token = await ensureToken();
      const text = await downloadBackup(token);
      if (!text) { onToast?.('Googleドライブにバックアップが見つかりませんでした'); return; }
      const data = JSON.parse(text);
      await importBackup(data);
      onToast?.('Googleドライブから復元しました');
    } catch (e) {
      onToast?.(e.message || 'Googleドライブからの復元に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const doSignOut = () => {
    signOut();
    setSignedIn(false);
    onToast?.('Googleからログアウトしました（この端末のバックアップデータは残ります）');
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginBottom: 10 }}>
        <strong>⚠️ この機能だけは、Googleのサーバー（Googleアカウント・Google Drive）と通信します。</strong>
        {' '}アプリの基本方針（サーバー不要・外部に送信しない）の明示的な例外です。使うかどうかは任意で、
        設定しない限り何も送信されません。保存先はあなた自身のGoogleドライブの中の
        「アプリ専用領域（appDataFolder）」で、あなたの他のDriveファイルには一切アクセスしません。
      </p>

      {!open ? (
        <button className="btn" onClick={() => setOpen(true)}>☁️ Googleドライブ連携を設定する</button>
      ) : (
        <div>
          <div className="section-label" style={{ marginTop: 0 }}>① OAuthクライアントIDの発行（初回のみ・ご自身で行う操作です）</div>
          <ol className="inline-note" style={{ marginTop: 0, paddingLeft: 18 }}>
            <li>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                Google Cloud Console（認証情報）
              </a>
              を開き、プロジェクトを作成（または選択）します。
            </li>
            <li>「OAuth 同意画面」を設定します（種類は「外部」、テストユーザーにご自身のGoogleアカウントを追加）。</li>
            <li>「認証情報を作成」→「OAuthクライアントID」→ アプリケーションの種類は「ウェブ アプリケーション」を選びます。</li>
            <li>
              「承認済みの JavaScript 生成元」に、このアプリのURL（
              <code>{typeof location !== 'undefined' ? location.origin : 'https://youtaix656-eng.github.io'}</code>
              ）を追加します。
            </li>
            <li>発行された「クライアントID」（<code>xxxx.apps.googleusercontent.com</code> の形式）を下に貼り付けます。</li>
          </ol>

          <div className="field" style={{ marginTop: 10 }}>
            <label>OAuthクライアントID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => updateSettings({ googleDriveClientId: e.target.value })}
              placeholder="例）1234567890-abc...apps.googleusercontent.com"
            />
          </div>

          <div className="section-label">② 連携・保存・復元</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            「保存」を押すとGoogleのログイン・同意画面が開きます（初回のみ）。以後は同じGoogleアカウントで
            別の端末から「復元」すれば引き継げます。
            {lastSync && <><br />最終同期：{new Date(lastSync).toLocaleString('ja-JP')}</>}
          </p>
          <div className="btn-row">
            <button className="btn primary" onClick={doUpload} disabled={busy || !clientId.trim()}>
              {busy ? '通信中…' : '☁️ Googleドライブへ保存'}
            </button>
            <button className="btn" onClick={doRestore} disabled={busy || !clientId.trim()}>
              復元（Googleドライブから読み込み）
            </button>
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            {(signedIn || hasSession()) && (
              <button className="btn ghost sm" onClick={doSignOut}>Googleからログアウト</button>
            )}
            <button className="btn ghost sm" onClick={() => setOpen(false)}>閉じる</button>
          </div>

          <div className="section-label">③ 自動同期（任意）</div>
          <label className="switch-row" style={{ marginTop: 0 }}>
            <input
              type="checkbox"
              checked={!!settings.googleDriveAutoSync}
              onChange={(e) => updateSettings({ googleDriveAutoSync: e.target.checked })}
            />
            <span>
              開くたびに自動で同期する
              <small>
                アプリを開いた時と、解答・メモ等が変わった数秒後に、確認画面を出さず裏で
                Googleドライブと同期します（進捗・設定のみ、問題データは含みません）。片方の端末だけの
                進捗が消えないよう、問題ごと・解答記録ごとにマージします。初回は上の「保存」または
                「復元」を一度手動で行い、Googleへのログインを済ませてください（以後は自動）。
              </small>
            </span>
          </label>
          {settings.googleDriveAutoSync && cloudSyncStatus && (
            <p className="inline-note" style={{ marginTop: 6 }}>
              {cloudSyncStatus.ok
                ? `最終自動同期：${new Date(cloudSyncStatus.at).toLocaleString('ja-JP')}${cloudSyncStatus.pulled ? '（他端末の進捗を反映しました）' : ''}`
                : `自動同期を試みましたが失敗しました（${cloudSyncStatus.error || '不明なエラー'}）。次の機会に再試行します。`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
