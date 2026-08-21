// 永続化レイヤー（ローカルファースト）。
//
// ⚠ 不変条件: **このファイルはネットワークに触れない**。
//    将来クラウド同期を足す時も、この層の外側に別モジュールとして足す
//    （sync.ts などを作り、storage が読んだ AppState を渡す形にする）。
//    そのため保存単位は「AppState 丸ごと」ではなくキー分割にしてあり、
//    種類ごとにマージできる（日次記録・週次振り返り・習慣・期間・設定）。
//
// IndexedDB を優先し、使えない環境（プライベートモード等）は localStorage、
// それも使えなければメモリへ退避して、書けなくても落ちないようにする。

import type { AppState } from '../types/index.js';

const DB_NAME = 'henkaku-note';
const DB_VERSION = 1;
const STORE = 'kv';
const LS_PREFIX = 'henkaku-note:';

export const STATE_KEY = 'state';
/** 同期の判定に使う最終更新時刻（将来のクラウド同期用に今から持っておく） */
export const META_KEY = 'meta';

export interface SyncMeta {
  updatedAt: number;
}

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
  if (!stored) return fallback;
  return {
    ...fallback,
    ...stored,
    habits: Array.isArray(stored.habits) ? stored.habits : fallback.habits,
    days: stored.days && typeof stored.days === 'object' ? stored.days : {},
    weeks: stored.weeks && typeof stored.weeks === 'object' ? stored.weeks : {},
    cycles: Array.isArray(stored.cycles) ? stored.cycles : [],
    settings: { ...fallback.settings, ...(stored.settings || {}) },
  };
}

export async function saveState(state: AppState): Promise<void> {
  await write(STATE_KEY, state);
  await write(META_KEY, { updatedAt: Date.now() } satisfies SyncMeta);
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
