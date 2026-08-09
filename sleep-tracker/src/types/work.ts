// 施術中コンディション記録（勤務ログ）。個人の睡眠記録とは別軸だが、
// 前夜の睡眠データ（SleepRecord）を参照して相関分析につなげる。

export type VentilationStatus = 'normal' | 'broken' | 'unknown';

export const VENTILATION_LABELS: Record<VentilationStatus, string> = {
  normal: '正常',
  broken: '故障',
  unknown: '不明',
};

export type SymptomType = 'drowsiness' | 'blackout' | 'yawning' | 'headache' | 'fatigue' | 'other';

export const SYMPTOM_TYPE_LABELS: Record<SymptomType, string> = {
  drowsiness: '眠気',
  blackout: '意識が飛ぶ感覚',
  yawning: 'あくび',
  headache: '頭痛',
  fatigue: 'だるさ',
  other: 'その他',
};

export const SYMPTOM_TYPES: SymptomType[] = ['drowsiness', 'blackout', 'yawning', 'headache', 'fatigue', 'other'];

export interface SymptomEntry {
  id: string;
  time: string; // "HH:mm"（記録ボタンを押した時刻を自動記録）
  types: SymptomType[]; // 複数選択可
  otherNote?: string; // 「その他」を選んだときの自由記入
  intensity: 1 | 2 | 3 | 4 | 5;
}

export interface CaffeineIntake {
  taken: boolean;
  time?: string; // "HH:mm"
  amount?: string; // 自由入力（例: コーヒー1杯・エナジードリンク1本）
}

export interface ShiftLog {
  id: string;
  date: string; // "YYYY-MM-DD"（勤務開始日）
  startTime: string; // "HH:mm" 勤務開始時刻
  ventilation: VentilationStatus;
  priorSleepHours?: number; // 前夜の睡眠時間
  priorSleepAuto: boolean; // true: 睡眠記録から自動計算、false: 手入力
  priorSleepPattern?: { start: string; end: string }; // 前夜の就寝・起床時刻
  caffeine: CaffeineIntake;
  symptoms: SymptomEntry[];
  memo: string;
  createdAt: string;
  updatedAt: string;
}
