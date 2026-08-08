import type { TimeRange } from './sleep';

export interface ScheduleSuggestion {
  workEndTime: string;
  coreSleep: TimeRange;
  naps: TimeRange[];
  preventiveNapNotes: string[]; // 過去のモヤ傾向から生成
}
