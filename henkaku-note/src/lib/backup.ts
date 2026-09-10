// 書き出し・取り込み（端末の機能を呼ぶだけ。アプリが外部へ送ることはない）。
// 将来のクラウド同期も、この形（種類ごとに分かれたJSON）をそのまま運べる設計にしてある。

import type { AppState } from '../types/index.js';
import { normalizeTocData } from './tocStore.js';

export const BACKUP_KIND = 'henkaku-note-backup';
export const BACKUP_VERSION = 1;

export function toJson(state: AppState, at: number): string {
  return JSON.stringify(
    { app: 'henkaku-note', kind: BACKUP_KIND, version: BACKUP_VERSION, exportedAt: at, state },
    null,
    2,
  );
}

export interface ParseResult {
  ok: boolean;
  state?: AppState;
  error?: string;
}

export function parseJson(text: string, fallback: AppState): ParseResult {
  let data: any;
  try {
    data = JSON.parse(String(text));
  } catch {
    return { ok: false, error: 'ファイルの形式が読み取れませんでした。' };
  }
  if (!data || data.app !== 'henkaku-note' || data.kind !== BACKUP_KIND) {
    return { ok: false, error: '変革ノートのバックアップファイルではありません。' };
  }
  const s = data.state;
  if (!s || typeof s !== 'object') return { ok: false, error: '中身が空でした。' };
  return {
    ok: true,
    state: {
      ...fallback,
      ...s,
      habits: Array.isArray(s.habits) ? s.habits : fallback.habits,
      days: s.days && typeof s.days === 'object' ? s.days : {},
      weeks: s.weeks && typeof s.weeks === 'object' ? s.weeks : {},
      cycles: Array.isArray(s.cycles) ? s.cycles : [],
      threeRules: s.threeRules && typeof s.threeRules === 'object' ? s.threeRules : {},
      toc: normalizeTocData(s.toc),
      settings: { ...fallback.settings, ...(s.settings || {}) },
    },
  };
}

export function backupFileName(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `henkaku-note-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
}

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickTextFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}
