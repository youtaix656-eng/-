// 永続化レイヤー（端末内のみ）。
//
// ⚠ 不変条件：**このファイルはネットワークに触れない**（fetch・XHR・WebSocket を持たない）。
//    「記録はどこへも送らない」という約束の根拠がここ。クラウド同期を足したくなっても、
//    この層の外側に別のモジュールとして作る（tests/rules.spec.ts が機械チェックする）。
//
// IndexedDB を優先し、使えない環境（プライベートモード等）は localStorage、
// それも使えなければメモリへ退避して、書けなくてもアプリが落ちないようにする。

import type { AppState, CareRecord, EffectId, Side, SymptomRecord, TimingId, Vas } from '../types/index.js';
import { BODY_REGIONS } from '../data/bodyRegions.js';
import { EFFECTS } from '../data/effects.js';
import { TIMINGS } from '../data/timings.js';
import { DEFAULT_QUICK_CARE } from '../data/quickCare.js';
import { isDateKey, keyOf } from './date.js';

const DB_NAME = 'taicho-karte';
const DB_VERSION = 1;
const STORE = 'kv';
const LS_PREFIX = 'taicho-karte:';

export const STATE_KEY = 'state';
export const STATE_VERSION = 1;

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

export function initialState(): AppState {
  return {
    version: STATE_VERSION,
    symptoms: [],
    cares: [],
    settings: { quickCareItems: [...DEFAULT_QUICK_CARE], lastView: 'home' },
  };
}

// ── 整形（外から来たものは必ずここを通す） ─────────────────────
const REGION_IDS = new Set(BODY_REGIONS.map((r) => r.id));
const EFFECT_IDS = new Set<string>(EFFECTS.map((e) => e.id));
const TIMING_IDS = new Set<string>(TIMINGS.map((t) => t.id));

function asSide(v: unknown): Side {
  return v === 'left' || v === 'right' || v === 'both' ? v : null;
}

function asVas(v: unknown): Vas | null {
  const n = typeof v === 'number' ? Math.round(v) : Number.NaN;
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return n as Vas;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** 1件の症状記録を整形する。必須項目が読めなければ null（黙って別の値に置き換えない） */
export function normalizeSymptom(raw: unknown): SymptomRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const at = typeof r.at === 'number' && Number.isFinite(r.at) ? r.at : null;
  const regionId = str(r.regionId);
  const vas = asVas(r.vas);
  if (!id || at == null || !REGION_IDS.has(regionId) || vas == null) return null;
  const timing = TIMING_IDS.has(str(r.timing)) ? (r.timing as TimingId) : 'other';
  return {
    id,
    at,
    regionId,
    side: asSide(r.side),
    vas,
    timing,
    timingOther: str(r.timingOther),
    note: str(r.note),
  };
}

export function normalizeCare(raw: unknown, knownSymptomIds?: Set<string>): CareRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const at = typeof r.at === 'number' && Number.isFinite(r.at) ? r.at : null;
  const content = str(r.content).trim();
  if (!id || at == null || !content) return null;
  const date = isDateKey(r.date) ? r.date : keyOf(at);
  const effect = EFFECT_IDS.has(str(r.effect)) ? (r.effect as EffectId) : 'same';
  const ids = Array.isArray(r.symptomIds) ? r.symptomIds.filter((x): x is string => typeof x === 'string') : [];
  return {
    id,
    date,
    at,
    content,
    effect,
    symptomIds: knownSymptomIds ? ids.filter((x) => knownSymptomIds.has(x)) : ids,
  };
}

/**
 * 保存済みの古い形・取り込んだファイルを必ず通す整形。
 * 項目が1つ欠けているだけで画面が落ちる、を防ぐ。
 */
export function normalizeState(stored: unknown, fallback: AppState = initialState()): AppState {
  if (!stored || typeof stored !== 'object') return fallback;
  const s = stored as Record<string, unknown>;
  const symptoms = (Array.isArray(s.symptoms) ? s.symptoms : [])
    .map(normalizeSymptom)
    .filter((x): x is SymptomRecord => x != null);
  const known = new Set(symptoms.map((x) => x.id));
  const cares = (Array.isArray(s.cares) ? s.cares : [])
    .map((c) => normalizeCare(c, known))
    .filter((x): x is CareRecord => x != null);
  const settingsRaw = s.settings && typeof s.settings === 'object' ? (s.settings as Record<string, unknown>) : {};
  const quick = Array.isArray(settingsRaw.quickCareItems)
    ? settingsRaw.quickCareItems.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : fallback.settings.quickCareItems;
  return {
    version: STATE_VERSION,
    symptoms: dedupeById(symptoms),
    cares: dedupeById(cares),
    settings: {
      quickCareItems: quick,
      lastView: str(settingsRaw.lastView) || fallback.settings.lastView,
    },
  };
}

function dedupeById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export async function loadState(): Promise<AppState> {
  const stored = await read<unknown>(STATE_KEY, null);
  return normalizeState(stored, initialState());
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

/** 設定画面の「保存されているデータ量」表示用（目安） */
export function approximateSize(state: AppState): number {
  try {
    return new Blob([JSON.stringify(state)]).size;
  } catch {
    return JSON.stringify(state).length;
  }
}
