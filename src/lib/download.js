// テキストデータをファイルとして保存させる共通ヘルパー。
// 外部ライブラリなし（Blob + 一時的な<a download>要素）。
// アプリ版（Android の WebView）では <a download> が効かないので、
// ネイティブ側（nativeBridge.js の nativeSaveTextFile）で「ダウンロード」フォルダへ保存する。
import { canNativeSaveFile, nativeSaveTextFile } from './nativeBridge.js';

// ブラウザでのダウンロード。<a> を画面に付けてから押し、URL はすぐには捨てない
// （押した直後に revoke すると、保存が始まる前に中身が消えて何も保存されない端末がある）。
export function browserDownload(content, filename, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try { document.body.removeChild(a); } catch (e) { /* noop */ }
    URL.revokeObjectURL(url);
  }, 4000);
}

// 保存する。アプリ版ならネイティブで保存し、結果（{ok, native, location, error}）を返す。
// 呼び出し側は戻り値を待たなくても動く（待てば成功・失敗を知らせられる）。
export async function downloadFile(content, filename, mime = 'text/plain') {
  if (canNativeSaveFile()) {
    try {
      const r = await nativeSaveTextFile(content, filename, mime);
      return { ok: true, native: true, location: r?.location || 'ダウンロード', filename: r?.filename || filename };
    } catch (e) {
      return { ok: false, native: true, error: (e && e.message) || '保存に失敗しました' };
    }
  }
  browserDownload(content, filename, mime);
  return { ok: true, native: false };
}

// バックアップのファイル名（日付は端末の日付。toISOString だと日本時間の朝は前日になる）
export function backupFileName(now = new Date()) {
  const p2 = (n) => String(n).padStart(2, '0');
  return `shinkyu_backup_${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}.json`;
}
