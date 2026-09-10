// 永続化レイヤー（端末内のみ）。
//
// ⚠ 不変条件：**このファイルはネットワークに触れない**（fetch・XHR・WebSocket を持たない）。
//    「記録はどこへも送らない」という約束の根拠がここ。同期を足したくなっても、
//    この層の外側に別のモジュールとして作る。
//
// IndexedDB を優先し、使えない環境（プライベートモード等）は localStorage、
// それも使えなければメモリへ退避して、書けなくてもアプリが落ちないようにする。

import type { AppState } from '../types/index.js';

const DB_NAME = 'kundalini-tracker';
const DB_VERSION = 1;
const STORE = 'kv';
const LS_PREFIX = 'kundalini:';

export const STATE_KEY = 'state';
export const META_KEY = 'meta';

const memory = new Map<string, unknown>();

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      // 端末によっては開いたまま返ってこないことがあるため、待ちすぎない
      setTimeout(() => resolve(null), 3000);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function lsGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return memory.get(key) as T | undefined;
  }
}

function lsSet(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    memory.set(key, value);
    return false;
  }
}

export async function read<T>(key: string, fallback: T): Promise<T> {
  const fromIdb = await idbGet<T>(key);
  if (fromIdb !== undefined) return fromIdb;
  const fromLs = lsGet<T>(key);
  return fromLs === undefined ? fallback : fromLs;
}

export async function write(key: string, value: unknown): Promise<void> {
  // localStorage にも書いておく（IndexedDB が消える端末があるため二重に持つ）
  lsSet(key, value);
  await idbSet(key, value);
}

export async function loadState(fallback: AppState): Promise<AppState> {
  const stored = await read<Partial<AppState> | null>(STATE_KEY, null);
  return normalizeState(stored, fallback);
}

/**
 * 外から来たもの（保存済みの古い形・取り込んだファイル）を必ず通す整形。
 * ここを通さないと、項目が1つ欠けているだけで画面が落ちる。
 */
export function normalizeState(stored: Partial<AppState> | null | undefined, fallback: AppState): AppState {
  if (!stored || typeof stored !== 'object') return fallback;
  const days = stored.days && typeof stored.days === 'object' ? stored.days : {};
  const cleanDays: AppState['days'] = {};
  for (const [key, d] of Object.entries(days)) {
    if (!d || typeof d !== 'object') continue;
    cleanDays[key] = {
      date: key,
      body: (d.body ?? null) as AppState['days'][string]['body'],
      focus: (d.focus ?? null) as AppState['days'][string]['focus'],
      mood: (d.mood ?? null) as AppState['days'][string]['mood'],
      journal: typeof d.journal === 'string' ? d.journal : '',
      updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0,
    };
  }
  return {
    ...fallback,
    ...stored,
    startedAt: typeof stored.startedAt === 'number' ? stored.startedAt : null,
    relapses: Array.isArray(stored.relapses)
      ? stored.relapses.filter((r) => r && typeof r.at === 'number' && typeof r.startedAt === 'number')
          .map((r) => ({ ...r, triggers: Array.isArray(r.triggers) ? r.triggers : [], note: typeof r.note === 'string' ? r.note : '' }))
      : [],
    days: cleanDays,
    urges: Array.isArray(stored.urges) ? stored.urges.filter((u) => u && typeof u.at === 'number') : [],
    settings: { ...fallback.settings, ...(stored.settings || {}) },
  };
}

export async function saveState(state: AppState): Promise<void> {
  await write(STATE_KEY, state);
  await write(META_KEY, { updatedAt: Date.now() });
}

export async function clearAll(): Promise<void> {
  await write(STATE_KEY, null);
  try {
    localStorage.removeItem(LS_PREFIX + STATE_KEY);
  } catch {
    memory.clear();
  }
}

/** 設定画面の「保存されているデータ量」表示用（目安） */
export function approximateSize(state: AppState): number {
  try {
    return new Blob([JSON.stringify(state)]).size;
  } catch {
    return JSON.stringify(state).length;
  }
}
