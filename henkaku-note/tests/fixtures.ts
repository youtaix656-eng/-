// テスト用の共通の材料。
// Settings は機能を足すたびに項目が増えるので、**1か所にまとめる**
// （各テストに書き写すと、項目を足すたびに全部のテストが壊れる）。

import { defaultSettings } from '../src/lib/useStore.js';
import type { Settings } from '../src/types/index.js';

export function testSettings(over: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), ...over };
}
