// アプリ全体の状態。外部ライブラリを使わない小さなストア（購読＋永続化）。
// 保存は storage.ts に閉じ、ここは「どう変えるか」だけを持つ。

import { useSyncExternalStore } from 'react';
import { clearAll, initialState, loadState, normalizeState, saveState } from './storage.js';
import { newId } from './ids.js';
import type { AppState, CareRecord, Settings, SymptomRecord } from '../types/index.js';

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

export type SymptomInput = Omit<SymptomRecord, 'id' | 'at'> & { at?: number };
export type CareInput = Omit<CareRecord, 'id' | 'at'> & { at?: number };

export const actions = {
  async hydrate() {
    state = await loadState();
    hydrated = true;
    emit(false);
  },

  addSymptom(input: SymptomInput): SymptomRecord {
    const at = input.at ?? Date.now();
    const rec: SymptomRecord = { ...input, id: newId(at), at };
    set((s) => ({ ...s, symptoms: [...s.symptoms, rec] }));
    return rec;
  },
  updateSymptom(id: string, patch: Partial<Omit<SymptomRecord, 'id'>>) {
    set((s) => ({ ...s, symptoms: s.symptoms.map((x) => (x.id === id ? { ...x, ...patch, id } : x)) }));
  },
  /** 症状を消しても、紐づいていた対応策は残す（紐づけだけ外す） */
  removeSymptom(id: string) {
    set((s) => ({
      ...s,
      symptoms: s.symptoms.filter((x) => x.id !== id),
      cares: s.cares.map((c) => (c.symptomIds.includes(id) ? { ...c, symptomIds: c.symptomIds.filter((x) => x !== id) } : c)),
    }));
  },

  addCare(input: CareInput): CareRecord {
    const at = input.at ?? Date.now();
    const rec: CareRecord = { ...input, id: newId(at), at };
    set((s) => ({ ...s, cares: [...s.cares, rec] }));
    return rec;
  },
  updateCare(id: string, patch: Partial<Omit<CareRecord, 'id'>>) {
    set((s) => ({ ...s, cares: s.cares.map((x) => (x.id === id ? { ...x, ...patch, id } : x)) }));
  },
  removeCare(id: string) {
    set((s) => ({ ...s, cares: s.cares.filter((x) => x.id !== id) }));
  },

  setSettings(patch: Partial<Settings>) {
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },

  /** 取り込み（画面側で確認を出してから呼ぶ。今のデータを置き換える） */
  replaceAll(next: AppState) {
    set(() => normalizeState(next, initialState()));
  },

  async wipe() {
    await clearAll();
    state = initialState();
    emit(false);
  },
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
