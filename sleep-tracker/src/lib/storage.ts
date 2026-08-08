// 永続化レイヤー（IndexedDB 優先・localStorage フォールバック）
// SleepRecordRepository インターフェース越しにのみ画面側からアクセスする。
// 将来 API バックエンドに差し替える際は ApiSleepRepository を追加するだけでよい。

import { idbGet, idbSet, isIdbSupported } from './db';
import type { SleepRecord } from '../types/sleep';
import type { NapTimerState } from '../types/napTimer';
import type { AppSettings } from '../types/settings';

const KEYS = {
  records: 'sleep:records',
  napTimer: 'sleep:napTimer',
  pendingNap: 'sleep:pendingNap',
  lastDefaults: 'sleep:lastDefaults',
  settings: 'sleep:settings',
} as const;

const useIdb = isIdbSupported();

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    if (useIdb) {
      const v = await idbGet<T>(key);
      return v === undefined ? fallback : v;
    }
  } catch (e) {
    console.warn('idb read failed, fallback to localStorage', key, e);
  }
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch (e) {
    console.warn('storage read failed', key, e);
    return fallback;
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  try {
    if (useIdb) {
      await idbSet(key, value);
      return;
    }
  } catch (e) {
    console.warn('idb write failed, fallback to localStorage', key, e);
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('storage write failed', key, e);
  }
}

// ---------------- SleepRecordRepository ----------------

export interface SleepRecordRepository {
  list(range?: { from: string; to: string }): Promise<SleepRecord[]>;
  get(id: string): Promise<SleepRecord | undefined>;
  upsert(record: SleepRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

class IndexedDbSleepRepository implements SleepRecordRepository {
  async list(range?: { from: string; to: string }): Promise<SleepRecord[]> {
    const all = await read<SleepRecord[]>(KEYS.records, []);
    const sorted = [...all].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!range) return sorted;
    return sorted.filter((r) => r.date >= range.from && r.date <= range.to);
  }

  async get(id: string): Promise<SleepRecord | undefined> {
    const all = await read<SleepRecord[]>(KEYS.records, []);
    return all.find((r) => r.id === id);
  }

  async upsert(record: SleepRecord): Promise<void> {
    const all = await read<SleepRecord[]>(KEYS.records, []);
    const idx = all.findIndex((r) => r.id === record.id);
    if (idx === -1) {
      all.push(record);
    } else {
      all[idx] = record;
    }
    await write(KEYS.records, all);
    await write(KEYS.lastDefaults, {
      coreSleep: record.coreSleep,
      workEndTime: record.workEndTime,
    });
  }

  async remove(id: string): Promise<void> {
    const all = await read<SleepRecord[]>(KEYS.records, []);
    await write(
      KEYS.records,
      all.filter((r) => r.id !== id)
    );
  }
}

export const sleepRepository: SleepRecordRepository = new IndexedDbSleepRepository();

// ---------------- 仮眠タイマー状態（フォアグラウンド復帰時の差分判定に使用） ----------------

export async function loadNapTimer(): Promise<NapTimerState | undefined> {
  return read<NapTimerState | undefined>(KEYS.napTimer, undefined);
}

export async function saveNapTimer(state: NapTimerState): Promise<void> {
  await write(KEYS.napTimer, state);
}

export async function clearNapTimer(): Promise<void> {
  await write(KEYS.napTimer, undefined);
}

// ---------------- 直近の入力デフォルト（入力の手間を減らす） ----------------

export interface LastDefaults {
  coreSleep?: { start: string; end: string };
  workEndTime?: string;
}

export async function loadLastDefaults(): Promise<LastDefaults> {
  return read<LastDefaults>(KEYS.lastDefaults, {});
}

// ---------------- アプリ設定（目標睡眠時間・通知） ----------------

export async function loadSettings(): Promise<AppSettings> {
  return read<AppSettings>(KEYS.settings, {});
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await write(KEYS.settings, settings);
}

// ---------------- バックアップ（全記録のエクスポート／インポート） ----------------

export interface BackupFile {
  app: 'sleep-tracker';
  version: 1;
  exportedAt: string;
  records: SleepRecord[];
  settings: AppSettings;
}

export async function exportBackup(): Promise<BackupFile> {
  const records = await read<SleepRecord[]>(KEYS.records, []);
  const settings = await read<AppSettings>(KEYS.settings, {});
  return { app: 'sleep-tracker', version: 1, exportedAt: new Date().toISOString(), records, settings };
}

// 既存の記録とID一致するものは上書き、それ以外は追加する（取り込みのやり直しでも重複しない）。
export async function importBackup(file: BackupFile): Promise<number> {
  if (file.app !== 'sleep-tracker' || !Array.isArray(file.records)) {
    throw new Error('このアプリのバックアップファイルではありません');
  }
  const existing = await read<SleepRecord[]>(KEYS.records, []);
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const r of file.records) byId.set(r.id, r);
  await write(KEYS.records, [...byId.values()]);
  if (file.settings) await write(KEYS.settings, file.settings);
  return file.records.length;
}
