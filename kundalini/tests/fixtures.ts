// テスト用の共通の材料。
// Settings は機能を足すたびに項目が増えるので**1か所にまとめる**
// （各テストに書き写すと、項目を足すたびに全部のテストが壊れる）。

import { defaultSettings, initialState } from '../src/lib/useStore.js';
import type { AppState, Relapse, Settings } from '../src/types/index.js';

export const DAY = 86400000;

export function testSettings(over: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), ...over };
}

export function testState(over: Partial<AppState> = {}): AppState {
  return { ...initialState(), ...over, settings: testSettings(over.settings ?? {}) };
}

export function relapse(startedAt: number, at: number, triggers: string[] = []): Relapse {
  return { id: `${startedAt}-${at}`, startedAt, at, triggers, note: '' };
}
