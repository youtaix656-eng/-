import type { SoundId } from '../types/index.js';

// 開始音・終了音の種類。音声ファイルは持たず、lib/bell.ts がその場で作る。
export interface SoundOption {
  id: SoundId;
  name: string;
  note: string;
}

export const SOUND_OPTIONS: SoundOption[] = [
  { id: 'none', name: 'なし', note: '音を出さない' },
  { id: 'bell', name: 'ベル', note: '短く澄んだ一音' },
  { id: 'soft', name: 'やわらかい音', note: '低めで丸い一音' },
  { id: 'wood', name: '木の音', note: '乾いた短い音' },
  { id: 'chime', name: 'チャイム', note: '二音が続く' },
];

export function soundName(id: SoundId): string {
  return SOUND_OPTIONS.find((s) => s.id === id)?.name ?? 'なし';
}
