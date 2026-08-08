// 起床直後の状態（1: だるい 〜 5: 冴えていた）
export type WakeState = 1 | 2 | 3 | 4 | 5;
export type StudyPerformance = 1 | 2 | 3 | 4 | 5;
export type NapAfterState = 'refreshed' | 'neutral' | 'groggy';
// すっきり           ふつう          まだ眠い

export const WAKE_STATE_LABELS: Record<WakeState, string> = {
  1: 'だるい',
  2: 'いまいち',
  3: 'ふつう',
  4: 'まずまず',
  5: '冴えていた',
};

export const WAKE_STATE_EMOJI: Record<WakeState, string> = {
  1: '😩',
  2: '🙁',
  3: '😐',
  4: '🙂',
  5: '😄',
};

export const NAP_AFTER_STATE_LABELS: Record<NapAfterState, string> = {
  refreshed: 'すっきり',
  neutral: 'ふつう',
  groggy: 'まだ眠い',
};

export interface TimeRange {
  start: string; // "HH:mm"
  end: string; // "HH:mm"（日をまたぐ場合 end < start）
}

export interface Nap extends TimeRange {
  id: string;
  afterState: NapAfterState;
}

export interface GrogginessPeriod extends TimeRange {
  id: string;
  intensity: 1 | 2 | 3 | 4 | 5; // モヤの強さ
  note?: string;
}

export interface SleepRecord {
  id: string; // crypto.randomUUID()
  date: string; // "YYYY-MM-DD"（コア睡眠の開始日）
  coreSleep: TimeRange;
  wakeState: WakeState;
  naps: Nap[];
  grogginessPeriods: GrogginessPeriod[];
  totalSleepHours: number; // 自動計算し保存
  studyPerformance: StudyPerformance;
  workEndTime?: string; // "HH:mm" 提案機能の学習に使う
  memo: string;
  createdAt: string; // ISO日時
  updatedAt: string; // ISO日時（将来の同期の競合解決に使用）
}

export type NewSleepRecord = Omit<SleepRecord, 'id' | 'createdAt' | 'updatedAt' | 'totalSleepHours'>;
