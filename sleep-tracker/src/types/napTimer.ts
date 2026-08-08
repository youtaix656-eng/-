export interface NapTimerState {
  status: 'idle' | 'running' | 'done';
  durationMin: number; // プリセット 20 / 30、カスタムも可
  startedAt: string | null; // ISO
  endsAt: string | null; // ISO
}

export const NAP_PRESETS_MIN = [20, 30] as const;
