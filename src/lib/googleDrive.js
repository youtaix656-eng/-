// Google Drive（アプリ専用のappDataFolダー）へのクラウドバックアップ。
//
// ⚠️ このファイルだけは、他の機能と違いGoogleのサーバー（OAuth・Drive API）と通信する。
// アプリの基本方針（サーバー不要・外部に送信しない）の明示的な例外であり、使うかどうかは
// ユーザーが任意で選択する（Settings画面に注記あり）。
// Google Identity Services のスクリプトは、この機能を実際に使う時だけ動的に読み込む
// （使わないユーザーの端末には一切ロードされない）。
// OAuthクライアントIDはこちらで発行できないため、ユーザー自身がGoogle Cloud Consoleで
// 発行したものを設定画面に入力してもらう。アクセストークンはメモリ上のみに保持し、
// IndexedDB／localStorageなど端末の永続領域には保存しない。

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
export const BACKUP_FILENAME = 'shinkyu_backup.json';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

let gisLoadPromise = null;
function loadGis() {
  if (typeof window === 'undefined') return Promise.reject(new Error('この環境では利用できません'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { gisLoadPromise = null; reject(new Error('Google Identity Servicesの読み込みに失敗しました（通信環境をご確認ください）')); };
    document.head.appendChild(s);
  });
  return gisLoadPromise;
}

// アクセストークンはメモリ上のみに保持（永続化しない）
let cachedToken = null; // { access_token, expiresAt }

export function hasSession() {
  return !!(cachedToken && cachedToken.expiresAt > Date.now());
}

export function requestAccessToken(clientId) {
  return new Promise((resolve, reject) => {
    if (!clientId || !clientId.trim()) {
      reject(new Error('OAuthクライアントIDが未設定です。設定手順に沿って発行・入力してください'));
      return;
    }
    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
      resolve(cachedToken.access_token);
      return;
    }
    loadGis()
      .then(() => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId.trim(),
          scope: DRIVE_SCOPE,
          callback: (resp) => {
            if (!resp || resp.error) {
              reject(new Error(`Googleへのログインに失敗しました（${resp?.error || '不明なエラー'}）`));
              return;
            }
            cachedToken = { access_token: resp.access_token, expiresAt: Date.now() + (resp.expires_in || 3600) * 1000 };
            resolve(resp.access_token);
          },
          error_callback: (err) => reject(new Error(`Googleへのログインに失敗しました（${err?.type || '不明なエラー'}）`)),
        });
        client.requestAccessToken();
      })
      .catch(reject);
  });
}

export function signOut() {
  if (cachedToken && window.google?.accounts?.oauth2?.revoke) {
    try { window.google.accounts.oauth2.revoke(cachedToken.access_token, () => {}); } catch (e) { /* 失敗しても握りつぶす（ローカルの破棄が主目的） */ }
  }
  cachedToken = null;
}

// ===== 以下は副作用なしの純粋関数（テスト容易にするため分離） =====

// appDataFolder内をバックアップファイル名で検索するためのURL
export function buildSearchUrl(filename = BACKUP_FILENAME) {
  const q = encodeURIComponent(`name='${filename.replace(/'/g, "\\'")}' and trashed=false`);
  return `${DRIVE_FILES_ENDPOINT}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`;
}

// multipart/related のアップロード用ボディを組み立てる（Drive APIの仕様に沿った形式）
export function buildMultipartBody(metadata, content, boundary) {
  return (
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n` +
    `--${boundary}--`
  );
}

export function buildUploadUrl(existingId) {
  return existingId
    ? `${DRIVE_UPLOAD_ENDPOINT}/${existingId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`;
}

export function buildDownloadUrl(fileId) {
  return `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`;
}

// ===== 以下はfetchを伴う実処理 =====

async function findBackupFileId(token) {
  const res = await fetch(buildSearchUrl(), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive内の検索に失敗しました（HTTP ${res.status}）`);
  const data = await res.json();
  return data.files && data.files[0] ? data.files[0].id : null;
}

// content: バックアップ本体のJSON文字列（storage.exportAll()の結果をJSON.stringifyしたもの）
export async function uploadBackup(token, content) {
  const existingId = await findBackupFileId(token);
  const metadata = existingId ? { name: BACKUP_FILENAME } : { name: BACKUP_FILENAME, parents: ['appDataFolder'] };
  const boundary = `shinkyu-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const body = buildMultipartBody(metadata, content, boundary);
  const res = await fetch(buildUploadUrl(existingId), {
    method: existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Google Driveへの保存に失敗しました（HTTP ${res.status}）`);
  return res.json();
}

// 戻り値: バックアップ本体のJSON文字列。appDataFolderに保存が無ければ null
export async function downloadBackup(token) {
  const fileId = await findBackupFileId(token);
  if (!fileId) return null;
  const res = await fetch(buildDownloadUrl(fileId), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google Driveからの取得に失敗しました（HTTP ${res.status}）`);
  return res.text();
}
