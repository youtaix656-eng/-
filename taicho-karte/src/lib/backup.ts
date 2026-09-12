// 書き出し・取り込み（JSON）。ネットワークには触れない。
// 取り込みは必ず normalizeState を通し、「今のデータを置き換える」と分かる確認を画面側で出す。

import type { AppState } from '../types/index.js';
import { normalizeState, STATE_VERSION } from './storage.js';

export const BACKUP_KIND = 'taicho-karte-backup';

export interface BackupFile {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: number;
  state: AppState;
}

export function makeBackup(state: AppState, now: number = Date.now()): BackupFile {
  return { kind: BACKUP_KIND, version: STATE_VERSION, exportedAt: now, state };
}

export function serializeBackup(state: AppState, now: number = Date.now()): string {
  return JSON.stringify(makeBackup(state, now), null, 2);
}

/** 読めなければ理由を返す（黙って空のデータに置き換えない） */
export function parseBackup(text: string): { ok: true; state: AppState } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'JSON として読めませんでした' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, reason: '中身が空です' };
  const r = raw as Record<string, unknown>;
  if (r.kind !== BACKUP_KIND) return { ok: false, reason: 'このアプリの書き出しファイルではありません' };
  const state = normalizeState(r.state);
  return { ok: true, state };
}

/** 書き出しファイルの名前（'taicho-karte-2026-09-12.json'） */
export function backupFilename(dateKey: string): string {
  return `taicho-karte-${dateKey}.json`;
}
