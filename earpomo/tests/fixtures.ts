// テスト用の共通の材料。Settings は項目が増えるので1か所にまとめる。
import { defaultSettings, initialState } from '../src/lib/storage.js';
import type { AppState, Preset, SessionRecord, Settings } from '../src/types/index.js';

export const MIN = 60000;

export const PRESET: Preset = { id: 'p', name: 'テスト 25/5/15', focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsCount: 4 };

export function testSettings(over: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), ...over };
}

export function testState(over: Partial<AppState> = {}): AppState {
  return { ...initialState(), ...over, settings: testSettings(over.settings ?? {}) };
}

export function rec(date: string, minutes: number, tag: string | null = null, completed = true, startedAt = 0): SessionRecord {
  return { id: `${date}-${minutes}-${tag ?? ''}-${startedAt}`, date, startedAt, durationMinutes: minutes, tag, completed };
}
