// 書き出し・取り込み（端末内のファイルとして渡すだけ。どこへも送らない）。
//
// ⚠ 取り込みは**必ず確認してから**（今のデータを置き換えると分かる文言で）。
// ⚠ 書き出したファイルには記録がそのまま入る。**置き場所に気をつけて**と必ず添える。
// ⚠ PIN のハッシュは書き出しに含めない（別の端末へロックごと持って行かない）。

import type { AppState } from '../types/index.js';

export const BACKUP_KIND = 'kundalini-tracker-backup';

export interface BackupFile {
  kind: string;
  version: number;
  exportedAt: number;
  state: AppState;
}

export function buildBackup(state: AppState, at: number): BackupFile {
  const { pinHash, pinKind, ...settings } = state.settings;
  void pinHash;
  void pinKind;
  return {
    kind: BACKUP_KIND,
    version: state.version,
    exportedAt: at,
    state: { ...state, settings: { ...settings, pinHash: null, pinKind: null } },
  };
}

/** 読めなければ理由を日本語で返す（黙って失敗しない） */
export function parseBackup(text: string): { ok: true; file: BackupFile } | { ok: false; reason: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'ファイルの中身が読めませんでした（JSONとして壊れています）。' };
  }
  if (!data || typeof data !== 'object') return { ok: false, reason: 'ファイルの形が違います。' };
  const file = data as Partial<BackupFile>;
  if (file.kind !== BACKUP_KIND) return { ok: false, reason: 'このアプリの書き出しファイルではないようです。' };
  if (!file.state || typeof file.state !== 'object') return { ok: false, reason: '記録が入っていません。' };
  return { ok: true, file: file as BackupFile };
}

export function backupFilename(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `kundalini-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
}
