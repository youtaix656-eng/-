// アプリ全体の状態。外部ライブラリを使わない小さなストア（購読＋永続化）。
// 保存は storage.ts に閉じ、ここは「どう変えるか」だけを持つ。

import { useSyncExternalStore } from 'react';
import { loadState, saveState, clearAll, normalizeState } from './storage.js';
import { DEFAULT_THRESHOLDS } from '../data/chakras.js';
import { todayKey } from './date.js';
import type { AppState, DateKey, DayRecord, Relapse, Scale5, Settings, UrgeLog } from '../types/index.js';

export const STATE_VERSION = 1;

export function defaultSettings(): Settings {
  return {
    levelThresholds: [...DEFAULT_THRESHOLDS],
    coolDownSeconds: 300,
    meditationMinutes: 5,
    bell: true,
    pinHash: null,
    pinKind: null,
    disguiseEnabled: false,
    disguiseTitle: '',
    disguiseIcon: '',
    lastView: 'home',
  };
}

export function initialState(): AppState {
  return {
    version: STATE_VERSION,
    startedAt: null,
    relapses: [],
    days: {},
    urges: [],
    settings: defaultSettings(),
  };
}

export function emptyDay(date: DateKey, at: number): DayRecord {
  return { date, body: null, focus: null, mood: null, journal: '', updatedAt: at };
}

let state: AppState = initialState();
let hydrated = false;
const listeners = new Set<() => void>();

function emit(persist = true) {
  if (persist && hydrated) void saveState(state);
  for (const l of listeners) l();
}

function set(updater: (s: AppState) => AppState) {
  state = updater(state);
  emit();
}

function withDay(s: AppState, date: DateKey, patch: (d: DayRecord) => DayRecord): AppState {
  const at = Date.now();
  const base = s.days[date] || emptyDay(date, at);
  const next = { ...patch(base), date, updatedAt: at };
  return { ...s, days: { ...s.days, [date]: next } };
}

function newId(at: number): string {
  return `${at.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export const actions = {
  async hydrate() {
    state = await loadState(initialState());
    hydrated = true;
    emit(false);
  },

  // ── 継続 ────────────────────────────────
  /** 数え始める（過去に戻して開始することもできる） */
  start(at: number = Date.now()) {
    set((s) => ({ ...s, startedAt: at }));
  },
  /** 開始時刻を直す（打ち間違い・あとから思い出した時） */
  setStartedAt(at: number) {
    set((s) => ({ ...s, startedAt: at }));
  },
  /**
   * リラプスを記録する。
   * いまの継続を閉じて、そこから新しい継続を始める
   * （**通算日数は減らない**——閉じたぶんは relapses に残る）。
   */
  recordRelapse(input: { at?: number; triggers: string[]; note: string }) {
    const at = input.at ?? Date.now();
    set((s) => {
      const startedAt = s.startedAt ?? at;
      const relapse: Relapse = {
        id: newId(at),
        at,
        startedAt,
        triggers: [...input.triggers],
        note: input.note.slice(0, 1000),
      };
      return { ...s, relapses: [...s.relapses, relapse], startedAt: at };
    });
  },
  updateRelapse(id: string, patch: Partial<Pick<Relapse, 'triggers' | 'note' | 'at'>>) {
    set((s) => ({ ...s, relapses: s.relapses.map((r) => (r.id === id ? { ...r, ...patch, id } : r)) }));
  },
  /** 記録違いを消す。いまの継続の開始時刻は動かさない（勝手に伸ばさない） */
  deleteRelapse(id: string) {
    set((s) => ({ ...s, relapses: s.relapses.filter((r) => r.id !== id) }));
  },

  // ── 日々の記録 ───────────────────────────
  setScale(date: DateKey, key: 'body' | 'focus' | 'mood', value: Scale5) {
    set((s) => withDay(s, date, (d) => ({ ...d, [key]: value })));
  },
  setJournal(date: DateKey, text: string) {
    set((s) => withDay(s, date, (d) => ({ ...d, journal: text.slice(0, 4000) })));
  },
  clearDay(date: DateKey) {
    set((s) => {
      const days = { ...s.days };
      delete days[date];
      return { ...s, days };
    });
  },

  // ── 緊急ボタン ───────────────────────────
  logUrge(seconds: number, finished: boolean) {
    const at = Date.now();
    const log: UrgeLog = { id: newId(at), at, seconds: Math.round(seconds), finished };
    set((s) => ({ ...s, urges: [...s.urges, log] }));
  },
  deleteUrge(id: string) {
    set((s) => ({ ...s, urges: s.urges.filter((u) => u.id !== id) }));
  },

  // ── 設定・データ ──────────────────────────
  setSettings(patch: Partial<Settings>) {
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
  replaceState(next: Partial<AppState>) {
    set(() => normalizeState(next, initialState()));
  },
  async resetAll() {
    await clearAll();
    state = initialState();
    emit();
  },
};

export function useStore(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

/** 今日のキー（画面から date を直に組み立てさせない） */
export function today(): DateKey {
  return todayKey();
}
