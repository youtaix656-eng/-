// 端末内エラーログ（#19 の外部SaaSを使わないローカル版）。
//   未処理例外・Promise拒否・任意の記録を IndexedDB に最新50件だけ残す。
//   外部送信は一切しない（プライバシー最優先）。設定画面で閲覧・消去できる。

import { idbGet, idbSet, idbDelete } from './db.js';

const KEY = 'shinkyu:errorLog';
const MAX = 50;

function short(v, n = 500) {
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s && s.length > n ? s.slice(0, n) + '…' : s;
  } catch (e) {
    return String(v);
  }
}

// 1件記録（失敗しても本体に影響させない）
export async function logError(kind, message, detail) {
  try {
    const list = (await idbGet(KEY)) || [];
    list.unshift({
      t: Date.now(),
      kind: String(kind || 'error'),
      message: short(message, 300),
      detail: detail ? short(detail, 600) : '',
    });
    await idbSet(KEY, list.slice(0, MAX));
  } catch (e) {
    /* ログ自体の失敗は握りつぶす */
  }
}

export async function getErrorLog() {
  try {
    return (await idbGet(KEY)) || [];
  } catch (e) {
    return [];
  }
}

export async function clearErrorLog() {
  try {
    await idbDelete(KEY);
  } catch (e) {
    /* noop */
  }
}

// グローバルの未処理例外を捕捉して記録（多重登録は防ぐ）
let installed = false;
export function installErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => {
    const where = e.filename ? `${e.filename}:${e.lineno || 0}` : '';
    logError('error', e.message || 'error', where);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    logError('promise', (r && (r.message || r.toString())) || 'unhandledrejection', r && r.stack);
  });
}
