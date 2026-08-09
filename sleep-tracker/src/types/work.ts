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

export type CopingMethod = 'faster_rhythm' | 'hold_breath' | 'oxygen_spray' | 'hydration' | 'other';

export const COPING_METHOD_LABELS: Record<CopingMethod, string> = {
  faster_rhythm: '施術リズムを速める',
  hold_breath: '息を止める',
  oxygen_spray: '酸素スプレー',
  hydration: '水分補給',
  other: 'その他',
};

export const COPING_METHODS: CopingMethod[] = ['faster_rhythm', 'hold_breath', 'oxygen_spray', 'hydration', 'other'];

export type CopingEffect = 'worked' | 'no_effect' | 'unknown';

export const COPING_EFFECT_LABELS: Record<CopingEffect, string> = {
  worked: 'あった',
  no_effect: 'なかった',
  unknown: 'わからない',
};

export interface CopingLog {
  methods: CopingMethod[];
  otherNote?: string;
  effect: CopingEffect;
}

export interface SymptomEntry {
  id: string;
  time: string; // "HH:mm"（記録ボタンを押した時刻を自動記録）
  types: SymptomType[]; // 複数選択可
  otherNote?: string; // 「その他」を選んだときの自由記入
  intensity: 1 | 2 | 3 | 4 | 5;
  coping?: CopingLog; // 症状記録の直後に試した対処法（任意）
}

export interface CaffeineIntake {
  taken: boolean;
  time?: string; // "HH:mm"
  amount?: string; // 自由入力（例: コーヒー1杯・エナジードリンク1本）
}

// このセラピストの施術メニュー（4種類固定）
export type TreatmentType = 'body_massage' | 'head_spa' | 'foot_reflexology' | 'hand_care';

export const TREATMENT_TYPE_LABELS: Record<TreatmentType, string> = {
  body_massage: 'もみほぐし',
  head_spa: 'ヘッドスパ',
  foot_reflexology: '足つぼ',
  hand_care: 'ハンドケア',
};

export const TREATMENT_TYPES: TreatmentType[] = ['body_massage', 'head_spa', 'foot_reflexology', 'hand_care'];

export interface TreatmentSession {
  id: string;
  type: TreatmentType;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export interface ShiftLog {
  id: string;
  date: string; // "YYYY-MM-DD"（勤務開始日）
  dayOff?: boolean; // 「今日は休み」。正常日/故障日などの母数から除外するために使う
  startTime: string; // "HH:mm" 勤務開始時刻
  ventilation: VentilationStatus;
  priorSleepHours?: number; // 前夜の睡眠時間
  priorSleepAuto: boolean; // true: 睡眠記録から自動計算、false: 手入力
  priorSleepPattern?: { start: string; end: string }; // 前夜の就寝・起床時刻
  caffeine: CaffeineIntake;
  tookBreaks?: boolean; // 休憩を取れたか
  continuousTreatmentHours?: number; // 休憩無しで連続施術した時間の目安
  sessions: TreatmentSession[]; // 施術記録
  symptoms: SymptomEntry[];
  memo: string;
  createdAt: string;
  updatedAt: string;
}
