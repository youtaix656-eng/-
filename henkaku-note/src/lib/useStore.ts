// アプリ全体の状態。外部ライブラリを使わない小さなストア（購読 + 永続化）。
// 保存は storage.ts に閉じ、ここは「どう変えるか」だけを持つ。

import { useSyncExternalStore } from 'react';
import { loadState, saveState, clearAll } from './storage.js';
import { buildDefaultHabits } from './habits.js';
import { DEFAULT_AUDIO_URL } from './audioLink.js';
import { startOfWeek, toKey } from './date.js';
import { emptyReview, isReviewWritten, reviewCheckDate } from './weekly.js';
import { WEEKLY_REVIEW_HABIT_ID } from './habits.js';
import { MEDITATION_HABIT_ID } from '../data/presets.js';
import { emptyCondition, conditionOf } from './condition.js';
import { emptySleepQuality } from './sleepQuality.js';
import { keyFor, normalizeThree, type Scope } from './threeRules.js';
import type { AppState, DayRecord, Habit, Settings, WeeklyReview, Cycle } from '../types/index.js';

export const STATE_VERSION = 1;

export function defaultSettings(): Settings {
  return {
    shiftEndDefault: '00:00',
    bedWithinMinutes: 90,
    offDayBedtime: '23:00',
    audioLinkEnabled: false,
    audioLinkUrl: DEFAULT_AUDIO_URL,
    showStreakProminently: false,
    meditationBell: true,
    meditationDefaultMinutes: 10,
    fastingTargetHours: 12,
    fastingWorkdayHours: 0,
    fastingPlan: 'three',
    fastingPlanSince: null,
    fastingPrechecks: [],
  };
}

export function initialState(at: number): AppState {
  return {
    version: STATE_VERSION,
    habits: buildDefaultHabits(at),
    days: {},
    weeks: {},
    cycles: [],
    settings: defaultSettings(),
    threeRules: {},
  };
}

let state: AppState = initialState(Date.now());
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

export function emptyDay(date: string, at: number): DayRecord {
  return {
    date,
    checked: [],
    declaration: '',
    note: '',
    shift: null,
    shiftEndsAt: null,
    sleep: null,
    meditations: [],
    updatedAt: at,
  };
}

function withDay(s: AppState, date: string, patch: (d: DayRecord) => DayRecord): AppState {
  const at = Date.now();
  const base = s.days[date] || emptyDay(date, at);
  const next = { ...patch(base), date, updatedAt: at };
  return { ...s, days: { ...s.days, [date]: next } };
}

export const actions = {
  async hydrate() {
    const loaded = await loadState(initialState(Date.now()));
    state = loaded;
    hydrated = true;
    emit(false);
  },

  // ── 日次記録 ──────────────────────────────
  toggleHabit(date: string, habitId: string) {
    set((s) =>
      withDay(s, date, (d) => ({
        ...d,
        checked: d.checked.includes(habitId) ? d.checked.filter((id) => id !== habitId) : [...d.checked, habitId],
      })),
    );
  },
  setDeclaration(date: string, text: string) {
    set((s) => withDay(s, date, (d) => ({ ...d, declaration: text })));
  },
  setNote(date: string, text: string) {
    set((s) => withDay(s, date, (d) => ({ ...d, note: text })));
  },
  setShift(date: string, shift: DayRecord['shift']) {
    set((s) => withDay(s, date, (d) => ({ ...d, shift })));
  },
  setShiftEndsAt(date: string, hhmm: string | null) {
    set((s) => withDay(s, date, (d) => ({ ...d, shiftEndsAt: hhmm })));
  },
  setSleep(date: string, sleep: DayRecord['sleep']) {
    set((s) => withDay(s, date, (d) => ({ ...d, sleep })));
  },
  /** 瞑想を1回ぶん記録する（長さより「やった日」を数えるが、長さも残す） */
  addMeditation(date: string, minutes: number) {
    if (!(minutes > 0)) return;
    set((s) => {
      const hasHabit = s.habits.some((h) => h.id === MEDITATION_HABIT_ID && h.archivedAt === null);
      return withDay(s, date, (d) => ({
        ...d,
        meditations: [...(d.meditations ?? []), { minutes: Math.round(minutes), recordedAt: Date.now() }],
        // 記録したのに習慣が未チェックのままだと二度手間になるので、ここで入れる
        checked: hasHabit && !d.checked.includes(MEDITATION_HABIT_ID) ? [...d.checked, MEDITATION_HABIT_ID] : d.checked,
      }));
    });
  },
  removeMeditation(date: string, index: number) {
    set((s) =>
      withDay(s, date, (d) => ({
        ...d,
        meditations: (d.meditations ?? []).filter((_, i) => i !== index),
      })),
    );
  },
  /** 『最高の体調』の記録。人間関係を書いたら①仲間にもチェックを入れる（同じことを2回聞かない） */
  setCondition(date: string, patch: Partial<ReturnType<typeof emptyCondition>>) {
    const socialTouched = patch.social === 'deep' || patch.social === 'light';
    set((s) => {
      const hasPeers = s.habits.some((h) => h.id === 'step1-peers' && h.archivedAt === null);
      return withDay(s, date, (d) => ({
        ...d,
        condition: { ...conditionOf(d), ...patch },
        checked:
          socialTouched && hasPeers && !d.checked.includes('step1-peers')
            ? [...d.checked, 'step1-peers']
            : d.checked,
      }));
    });
  },
  setSleepQuality(date: string, patch: Partial<ReturnType<typeof emptySleepQuality>>) {
    set((s) => withDay(s, date, (d) => ({ ...d, sleepQuality: { ...emptySleepQuality(), ...(d.sleepQuality ?? {}), ...patch } })));
  },

  /** 食事の記録（時間と量だけ） */
  setMeal(date: string, patch: Partial<import('../types/index.js').MealRecord>) {
    set((s) =>
      withDay(s, date, (d) => ({
        ...d,
        meal: {
          firstMealAt: null, lastMealAt: null, lastMealCrossesMidnight: false, fullness: null, signs: [],
          ...(d.meal ?? {}),
          ...patch,
        },
      })),
    );
  },
  /** 段階を変える。変えた日を覚えておき、次の段階へ進める判断に使う */
  setFastingPlan(planId: string, date: string) {
    set((s) => ({ ...s, settings: { ...s.settings, fastingPlan: planId, fastingPlanSince: date } }));
  },

  /** 3のルール。日・週・月を同じ表で持つ */
  setThreeRule(scope: Scope, date: string, index: number, text: string) {
    const key = keyFor(scope, date);
    set((s) => {
      const list = normalizeThree(s.threeRules?.[key]);
      list[index] = text.slice(0, 60);
      return { ...s, threeRules: { ...(s.threeRules ?? {}), [key]: list } };
    });
  },
  /** 上の階層から降ろす（空いている枠に入れる） */
  fillThreeRule(scope: Scope, date: string, text: string) {
    const key = keyFor(scope, date);
    set((s) => {
      const list = normalizeThree(s.threeRules?.[key]);
      const slot = list.findIndex((t) => t.trim().length === 0);
      if (slot < 0) return s;
      list[slot] = text.slice(0, 60);
      return { ...s, threeRules: { ...(s.threeRules ?? {}), [key]: list } };
    });
  },
  clearDay(date: string) {
    set((s) => {
      const days = { ...s.days };
      delete days[date];
      return { ...s, days };
    });
  },

  // ── 習慣 ────────────────────────────────
  addHabit(habit: Habit) {
    set((s) => ({ ...s, habits: [...s.habits, habit] }));
  },
  updateHabit(id: string, patch: Partial<Habit>) {
    set((s) => ({ ...s, habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch, id } : h)) }));
  },
  /** 削除ではなく「寝かせる」。過去の記録が読めなくなるため消さない */
  archiveHabit(id: string) {
    set((s) => ({ ...s, habits: s.habits.map((h) => (h.id === id ? { ...h, archivedAt: Date.now() } : h)) }));
  },
  restoreHabit(id: string) {
    set((s) => ({ ...s, habits: s.habits.map((h) => (h.id === id ? { ...h, archivedAt: null } : h)) }));
  },
  /** 本当に消す（その習慣のチェックも日次記録から取り除く） */
  deleteHabit(id: string) {
    set((s) => {
      const days: AppState['days'] = {};
      for (const [key, d] of Object.entries(s.days)) {
        days[key] = d.checked.includes(id) ? { ...d, checked: d.checked.filter((x) => x !== id) } : d;
      }
      return { ...s, habits: s.habits.filter((h) => h.id !== id), days };
    });
  },
  /** プリセットから習慣を足す（すでにあれば休止を解除するだけ） */
  addPresetHabit(habit: Habit) {
    set((s) => {
      const exists = s.habits.find((h) => h.id === habit.id);
      if (exists) return { ...s, habits: s.habits.map((h) => (h.id === habit.id ? { ...h, archivedAt: null } : h)) };
      return { ...s, habits: [...s.habits, habit] };
    });
  },
  resetHabitsToDefault() {
    set((s) => ({ ...s, habits: buildDefaultHabits(Date.now()) }));
  },

  // ── 週次振り返り ──────────────────────────
  /**
   * 週次振り返りを更新する。
   * 1項目でも書けたらステップ⑦の習慣に自動でチェックを入れる（同じことを2回書かせない）。
   * チェックを入れる日は reviewCheckDate が決める（週の中に残す）。
   */
  updateReview(anyDayInWeek: string, patch: Partial<WeeklyReview>) {
    const weekStart = startOfWeek(anyDayInWeek);
    const at = Date.now();
    set((s) => {
      const base = s.weeks[weekStart] || emptyReview(weekStart, at);
      const next: WeeklyReview = {
        ...base,
        ...patch,
        manager: { ...base.manager, ...(patch.manager || {}) },
        doer: { ...base.doer, ...(patch.doer || {}) },
        weekStart,
        updatedAt: at,
      };
      const weeks = { ...s.weeks, [weekStart]: next };

      const habit = s.habits.find((h) => h.id === WEEKLY_REVIEW_HABIT_ID && h.archivedAt === null);
      if (!habit || !isReviewWritten(next)) return { ...s, weeks };

      const date = reviewCheckDate(weekStart, toKey(new Date(at)));
      const day = s.days[date] || emptyDay(date, at);
      if (day.checked.includes(habit.id)) return { ...s, weeks };
      return {
        ...s,
        weeks,
        days: { ...s.days, [date]: { ...day, checked: [...day.checked, habit.id], updatedAt: at } },
      };
    });
  },

  // ── 実践期間 ─────────────────────────────
  startCycle(cycle: Cycle) {
    set((s) => ({
      ...s,
      cycles: [...s.cycles.map((c) => (c.endedAt === null ? { ...c, endedAt: Date.now() } : c)), cycle],
    }));
  },
  closeCycle(id: string, decision: Cycle['decision'], closingNote: string) {
    set((s) => ({
      ...s,
      cycles: s.cycles.map((c) => (c.id === id ? { ...c, endedAt: Date.now(), decision, closingNote } : c)),
    }));
  },
  updateCycle(id: string, patch: Partial<Cycle>) {
    set((s) => ({ ...s, cycles: s.cycles.map((c) => (c.id === id ? { ...c, ...patch, id } : c)) }));
  },

  // ── 設定・データ ──────────────────────────
  setSettings(patch: Partial<Settings>) {
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
  replaceState(next: AppState) {
    set(() => next);
  },
  async resetAll() {
    await clearAll();
    state = initialState(Date.now());
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
