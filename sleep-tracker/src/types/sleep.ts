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

// モヤの「きっかけ」候補タグ。頻度×強度を集計して傾向分析に使う。
export type GroggyTrigger =
  | 'caffeine'
  | 'heavy_meal'
  | 'hunger'
  | 'screen'
  | 'no_exercise'
  | 'sleep_debt'
  | 'weather'
  | 'condition'
  | 'other';

export const GROGGY_TRIGGER_LABELS: Record<GroggyTrigger, string> = {
  caffeine: 'カフェイン/エナジードリンク',
  heavy_meal: '食事(炭水化物・満腹)',
  hunger: '空腹',
  screen: '画面疲れ',
  no_exercise: '運動不足',
  sleep_debt: '寝不足の蓄積',
  weather: '気温/湿度',
  condition: '体調・生理',
  other: 'その他',
};

export const GROGGY_TRIGGERS = Object.keys(GROGGY_TRIGGER_LABELS) as GroggyTrigger[];

export interface GrogginessPeriod extends TimeRange {
  id: string;
  intensity: 1 | 2 | 3 | 4 | 5; // モヤの強さ
  triggers?: GroggyTrigger[]; // きっかけ（複数可・任意）
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
