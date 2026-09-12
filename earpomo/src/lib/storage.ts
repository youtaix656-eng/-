// 永続化レイヤー（端末内のみ）。
//
// ⚠ 不変条件：**このファイルはネットワークに触れない**（fetch・XHR・WebSocket を持たない）。
//    「曲も記録もどこへも送らない」という約束の根拠がここ。
//
// 状態（JSON）は IndexedDB を優先し、使えなければ localStorage、それも無理ならメモリへ。
// 曲の音声（Blob）は IndexedDB の別の場所にだけ置く（localStorage には入らない）。

import { DEFAULT_PRESETS } from '../data/presets.js';
import { initialTimer } from './session.js';
import type { AppState, BgmTrack, ExamDate, Preset, ScheduleEntry, SessionRecord, Settings, TimerState } from '../types/index.js';

const DB_NAME = 'earpomo';
const DB_VERSION = 1;
const STORE = 'kv';
const FILES = 'files';
const LS_PREFIX = 'earpomo:';

export const STATE_KEY = 'state';

const memory = new Map<string, unknown>();

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      setTimeout(() => resolve(null), 3000);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

async function idbSet(store: string, key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
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

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    memory.set(key, value);
  }
}

export async function read<T>(key: string, fallback: T): Promise<T> {
  const fromIdb = await idbGet<T>(STORE, key);
  if (fromIdb !== undefined) return fromIdb;
  const fromLs = lsGet<T>(key);
  return fromLs === undefined ? fallback : fromLs;
}

export async function write(key: string, value: unknown): Promise<void> {
  lsSet(key, value);
  await idbSet(STORE, key, value);
}

// ── 曲の音声（Blob）─────────────────────────
export async function readBlob(id: string): Promise<Blob | undefined> {
  return idbGet<Blob>(FILES, id);
}

/** 保存できたか返す（できなかった時は画面で伝える） */
export async function writeBlob(id: string, blob: Blob): Promise<boolean> {
  return idbSet(FILES, id, blob);
}

export async function deleteBlob(id: string): Promise<void> {
  await idbDelete(FILES, id);
}

// ── 状態の整形 ───────────────────────────────
export function defaultSettings(): Settings {
  return {
    startSound: 'bell',
    endSound: 'chime',
    vibrate: true,
    autoContinue: true,
    bgmId: null,
    bgmVolume: 0.6,
    headphoneConfirmed: false,
    keepAwake: false,
    notify: false,
    lastView: 'timer',
  };
}

export const STATE_VERSION = 1;

export function initialState(): AppState {
  const presets = DEFAULT_PRESETS.map((p) => ({ ...p }));
  return {
    version: STATE_VERSION,
    presets,
    activePresetId: presets[0].id,
    timer: initialTimer(presets[0]),
    records: [],
    schedule: [],
    exams: [],
    bgm: [],
    settings: defaultSettings(),
  };
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function cleanPreset(p: Partial<Preset> | null | undefined, fallback: Preset): Preset | null {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string') return null;
  return {
    id: p.id,
    name: str(p.name, fallback.name).slice(0, 40),
    focusMinutes: Math.max(1, Math.round(num(p.focusMinutes, fallback.focusMinutes))),
    shortBreakMinutes: Math.max(1, Math.round(num(p.shortBreakMinutes, fallback.shortBreakMinutes))),
    longBreakMinutes: Math.max(1, Math.round(num(p.longBreakMinutes, fallback.longBreakMinutes))),
    sessionsCount: Math.max(1, Math.round(num(p.sessionsCount, fallback.sessionsCount))),
  };
}

function cleanTimer(t: Partial<TimerState> | null | undefined, preset: Preset): TimerState {
  const base = initialTimer(preset);
  if (!t || typeof t !== 'object') return base;
  const phase = t.phase === 'short' || t.phase === 'long' ? t.phase : 'focus';
  const status = t.status === 'running' || t.status === 'paused' ? t.status : 'idle';
  const durationMs = Math.max(1000, num(t.durationMs, base.durationMs));
  const endAt = status === 'running' ? (typeof t.endAt === 'number' ? t.endAt : null) : null;
  return {
    phase,
    pomoIndex: Math.max(0, Math.round(num(t.pomoIndex, 0))),
    status: status === 'running' && endAt == null ? 'paused' : status,
    endAt,
    remainingMs: Math.min(durationMs, Math.max(0, num(t.remainingMs, durationMs))),
    durationMs,
    startedAt: typeof t.startedAt === 'number' ? t.startedAt : null,
    tag: typeof t.tag === 'string' && t.tag.trim() ? t.tag.slice(0, 40) : null,
  };
}

/**
 * 外から来たもの（保存済みの古い形・取り込んだファイル）を必ず通す整形。
 * ここを通さないと、項目が1つ欠けているだけで画面が落ちる。
 */
export function normalizeState(stored: Partial<AppState> | null | undefined, fallback: AppState): AppState {
  if (!stored || typeof stored !== 'object') return fallback;
  const presetsRaw = Array.isArray(stored.presets) ? stored.presets : [];
  let presets = presetsRaw.map((p) => cleanPreset(p, DEFAULT_PRESETS[0])).filter((p): p is Preset => p != null);
  if (presets.length === 0) presets = fallback.presets;
  const activePresetId = presets.some((p) => p.id === stored.activePresetId) ? (stored.activePresetId as string) : presets[0].id;
  const active = presets.find((p) => p.id === activePresetId) || presets[0];

  const records: SessionRecord[] = (Array.isArray(stored.records) ? stored.records : [])
    .filter((r): r is SessionRecord => !!r && typeof r === 'object' && typeof r.id === 'string' && typeof r.startedAt === 'number')
    .map((r) => ({
      id: r.id,
      date: str(r.date, ''),
      startedAt: r.startedAt,
      durationMinutes: Math.max(0, num(r.durationMinutes, 0)),
      tag: typeof r.tag === 'string' && r.tag.trim() ? r.tag : null,
      completed: r.completed !== false,
    }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));

  const schedule: ScheduleEntry[] = (Array.isArray(stored.schedule) ? stored.schedule : [])
    .filter((e): e is ScheduleEntry => !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.date === 'string')
    .map((e) => ({
      id: e.id,
      type: e.type === 'work' || e.type === 'school' ? e.type : 'other',
      date: e.date,
      startTime: str(e.startTime, '09:00'),
      endTime: str(e.endTime, '17:00'),
      repeat: e.repeat === 'daily' || e.repeat === 'weekly' || e.repeat === 'weekdays' ? e.repeat : 'none',
      memo: str(e.memo, '').slice(0, 500),
    }));

  const exams: ExamDate[] = (Array.isArray(stored.exams) ? stored.exams : [])
    .filter((e): e is ExamDate => !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.date === 'string')
    .map((e) => ({ id: e.id, name: str(e.name, '試験').slice(0, 60), date: e.date }));

  const bgm: BgmTrack[] = (Array.isArray(stored.bgm) ? stored.bgm : [])
    .filter((b): b is BgmTrack => !!b && typeof b === 'object' && typeof b.id === 'string')
    .map((b) => ({
      id: b.id,
      name: str(b.name, '曲').slice(0, 120),
      durationSec: typeof b.durationSec === 'number' && Number.isFinite(b.durationSec) ? b.durationSec : null,
      sizeBytes: Math.max(0, num(b.sizeBytes, 0)),
      addedAt: num(b.addedAt, 0),
    }));

  const settingsRaw = stored.settings && typeof stored.settings === 'object' ? stored.settings : {};
  const settings: Settings = { ...fallback.settings, ...settingsRaw };
  settings.bgmVolume = Math.min(1, Math.max(0, num(settings.bgmVolume, 0.6)));
  if (settings.bgmId != null && !bgm.some((b) => b.id === settings.bgmId)) settings.bgmId = null;

  return {
    ...fallback,
    version: STATE_VERSION,
    presets,
    activePresetId,
    timer: cleanTimer(stored.timer, active),
    records,
    schedule,
    exams,
    bgm,
    settings,
  };
}

export async function loadState(fallback: AppState): Promise<AppState> {
  const stored = await read<Partial<AppState> | null>(STATE_KEY, null);
  return normalizeState(stored, fallback);
}

export async function saveState(state: AppState): Promise<void> {
  await write(STATE_KEY, state);
}

export async function clearAll(): Promise<void> {
  await write(STATE_KEY, null);
  try {
    localStorage.removeItem(LS_PREFIX + STATE_KEY);
  } catch {
    memory.clear();
  }
}

/** 設定画面の「保存されているデータ量」表示用（目安。曲の音声は含まない） */
export function approximateSize(state: AppState): number {
  try {
    return new Blob([JSON.stringify(state)]).size;
  } catch {
    return JSON.stringify(state).length;
  }
}
