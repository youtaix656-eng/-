// 復元（バックアップ・Googleドライブ・端末間転送・QR）のあとの共通処理。
// 画面ごとに読み込んで持っている記録（模試の結果・誤答理由・再生履歴など）が古いまま残り、
// あとからそれが保存されて復元した内容を上書きしないよう、確定させてから読み込み直す。
import { flushNow } from './storage.js';

export async function reloadAfterRestore(delayMs = 1500) {
  try { await flushNow(); } catch (e) { /* noop */ }
  setTimeout(() => {
    try { window.location.reload(); } catch (e) { /* noop */ }
  }, delayMs);
}
