// アプリ全体の状態。外部ライブラリを使わない小さなストア（購読＋永続化）。
// 保存は storage.ts に閉じ、ここは「どう変えるか」だけを持つ。
// タイマーの遷移は session.ts（純粋関数）に閉じ、ここは now を渡すだけ。

import { useSyncExternalStore } from 'react';
import { clearAll, deleteBlob, initialState, loadState, normalizeState, saveState, writeBlob } from './storage.js';
import * as session from './session.js';
import { todayKey } from './date.js';
import { probeDuration } from './bgm.js';
import type { AppState, BgmTrack, ExamDate, Preset, ScheduleEntry, Settings } from '../types/index.js';
import type { PhaseEvent } from './session.js';

let state: AppState = initialState();
let hydrated = false;
const listeners = new Set<() => void>();

/** 局面の出来事を画面（音・振動・通知）へ伝える口 */
type PhaseListener = (events: PhaseEvent[], autoStarted: number, next: AppState) => void;
const phaseListeners = new Set<PhaseListener>();

function emit(persist = true) {
  if (persist && hydrated) void saveState(state);
  for (const l of listeners) l();
}

function set(updater: (s: AppState) => AppState) {
  state = updater(state);
  emit();
}

export function newId(at: number = Date.now()): string {
  return `${at.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function activePreset(s: AppState = state): Preset {
  return s.presets.find((p) => p.id === s.activePresetId) || s.presets[0];
}

function withEvents(s: AppState, events: PhaseEvent[]): AppState {
  if (events.length === 0) return s;
  const records = [...s.records];
  for (const ev of events) {
    const rec = session.recordOf(ev, newId(ev.at), (at) => todayKey(at));
    if (rec) records.push(rec);
  }
  return { ...s, records };
}

export const actions = {
  async hydrate() {
    state = await loadState(initialState());
    hydrated = true;
    emit(false);
  },

  onPhase(l: PhaseListener): () => void {
    phaseListeners.add(l);
    return () => phaseListeners.delete(l);
  },

  // ── タイマー ─────────────────────────────
  start(now = Date.now()) {
    set((s) => ({ ...s, timer: session.start(s.timer, now) }));
  },
  pause(now = Date.now()) {
    set((s) => ({ ...s, timer: session.pause(s.timer, now) }));
  },
  toggle(now = Date.now()) {
    if (state.timer.status === 'running') actions.pause(now);
    else actions.start(now);
  },
  skip(now = Date.now()) {
    let evs: PhaseEvent[] = [];
    set((s) => {
      const r = session.skip(s.timer, activePreset(s), now);
      evs = [r.event];
      return withEvents({ ...s, timer: r.state }, evs);
    });
    for (const l of phaseListeners) l(evs, 0, state);
  },
  /** 時計を進める。終わっていれば局面を閉じる（1秒ごと・タブ復帰時に呼ぶ） */
  tick(now = Date.now()) {
    if (state.timer.status !== 'running') return;
    const r = session.tick(state.timer, activePreset(state), state.settings.autoContinue, now);
    if (r.events.length === 0) return;
    set((s) => withEvents({ ...s, timer: r.state }, r.events));
    for (const l of phaseListeners) l(r.events, r.autoStarted, state);
  },
  /** いまの周期を最初から（走っていない時だけ） */
  resetCycle() {
    set((s) => (s.timer.status === 'running' ? s : { ...s, timer: session.initialTimer(activePreset(s), s.timer.tag) }));
  },
  setTag(tag: string | null) {
    set((s) => ({ ...s, timer: session.setTag(s.timer, tag) }));
  },

  // ── プリセット ────────────────────────────
  selectPreset(id: string) {
    set((s) => {
      const p = s.presets.find((x) => x.id === id);
      if (!p) return s;
      return { ...s, activePresetId: id, timer: session.applyPreset(s.timer, p) };
    });
  },
  addPreset(base?: Partial<Preset>): string {
    const id = newId();
    set((s) => {
      const from = activePreset(s);
      const p: Preset = {
        id,
        name: (base?.name ?? `${from.name} のコピー`).slice(0, 40),
        focusMinutes: base?.focusMinutes ?? from.focusMinutes,
        shortBreakMinutes: base?.shortBreakMinutes ?? from.shortBreakMinutes,
        longBreakMinutes: base?.longBreakMinutes ?? from.longBreakMinutes,
        sessionsCount: base?.sessionsCount ?? from.sessionsCount,
      };
      return { ...s, presets: [...s.presets, p] };
    });
    return id;
  },
  updatePreset(id: string, patch: Partial<Omit<Preset, 'id'>>) {
    set((s) => {
      const presets = s.presets.map((p) => (p.id === id ? { ...p, ...patch, id } : p));
      const active = presets.find((p) => p.id === s.activePresetId) || presets[0];
      return { ...s, presets, timer: id === s.activePresetId ? session.applyPreset(s.timer, active) : s.timer };
    });
  },
  deletePreset(id: string) {
    set((s) => {
      if (s.presets.length <= 1) return s;
      const presets = s.presets.filter((p) => p.id !== id);
      const activePresetId = s.activePresetId === id ? presets[0].id : s.activePresetId;
      const active = presets.find((p) => p.id === activePresetId) || presets[0];
      return { ...s, presets, activePresetId, timer: s.activePresetId === id ? session.applyPreset(s.timer, active) : s.timer };
    });
  },

  // ── 記録 ──────────────────────────────────
  deleteRecord(id: string) {
    set((s) => ({ ...s, records: s.records.filter((r) => r.id !== id) }));
  },

  // ── スケジュール・試験日 ────────────────────
  addSchedule(entry: Omit<ScheduleEntry, 'id'>): string {
    const id = newId();
    set((s) => ({ ...s, schedule: [...s.schedule, { ...entry, id, memo: entry.memo.slice(0, 500) }] }));
    return id;
  },
  updateSchedule(id: string, patch: Partial<Omit<ScheduleEntry, 'id'>>) {
    set((s) => ({ ...s, schedule: s.schedule.map((e) => (e.id === id ? { ...e, ...patch, id } : e)) }));
  },
  deleteSchedule(id: string) {
    set((s) => ({ ...s, schedule: s.schedule.filter((e) => e.id !== id) }));
  },
  addExam(exam: Omit<ExamDate, 'id'>): string {
    const id = newId();
    set((s) => ({ ...s, exams: [...s.exams, { ...exam, id, name: exam.name.slice(0, 60) }] }));
    return id;
  },
  deleteExam(id: string) {
    set((s) => ({ ...s, exams: s.exams.filter((e) => e.id !== id) }));
  },

  // ── BGM ───────────────────────────────────
  /** 端末の曲を追加する。保存できなければ null（理由は画面で伝える） */
  async addBgm(file: File): Promise<BgmTrack | null> {
    const id = newId();
    const ok = await writeBlob(id, file);
    if (!ok) return null;
    const durationSec = await probeDuration(file);
    const track: BgmTrack = { id, name: file.name || '曲', durationSec, sizeBytes: file.size, addedAt: Date.now() };
    set((s) => ({ ...s, bgm: [...s.bgm, track] }));
    return track;
  },
  selectBgm(id: string | null) {
    set((s) => ({ ...s, settings: { ...s.settings, bgmId: id != null && s.bgm.some((b) => b.id === id) ? id : null } }));
  },
  async removeBgm(id: string) {
    await deleteBlob(id);
    set((s) => ({
      ...s,
      bgm: s.bgm.filter((b) => b.id !== id),
      settings: { ...s.settings, bgmId: s.settings.bgmId === id ? null : s.settings.bgmId },
    }));
  },

  // ── 設定・データ ──────────────────────────
  setSettings(patch: Partial<Settings>) {
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
  replaceState(next: Partial<AppState>) {
    set(() => normalizeState(next, initialState()));
  },
  async resetAll() {
    for (const b of state.bgm) await deleteBlob(b.id);
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

export function getState(): AppState {
  return state;
}
