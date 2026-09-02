// 変革ノート — データ型
//
// 保存されるものはすべてこのファイルの型に従う（storage.ts が読み書きする単位）。
// 「導出できるもの（達成率・就寝目標時刻・ストリーク）は保存しない」を原則とする。
// ロジックを直したあとでも過去の記録を読み直せるようにするため。

/** ゴーストモードの7ステップ。カスタム習慣は step: null */
export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Habit {
  id: string;
  /** ①〜⑦の番号。カスタム習慣は null */
  step: StepNumber | null;
  title: string;
  /** 読み（ひらがな）。一覧を五十音で並べる時に使う。漢字を含むなら必ず入れる */
  reading: string;
  /** 何をもって達成とするか。判断に迷わないよう1文で書く */
  criterion: string;
  /** この習慣に紐づく補足（調整の理由など） */
  note?: string;
  createdAt: number;
  /** 使わなくなった習慣は消さずに寝かせる（過去の記録が読めなくなるため） */
  archivedAt: number | null;
}

export type ShiftKind = 'work' | 'off';

/** 就寝の記録。目標時刻は設定とシフトから導出するが、実績は記録する */
export interface SleepEntry {
  /** 実際に寝た時刻 'HH:MM'（その日の朝を跨ぐ場合は crossesMidnight が true） */
  actualAt: string;
  /** 日付が変わってからの就寝か（0:00〜11:59 は翌日扱い） */
  crossesMidnight: boolean;
  /** 記録した時刻（後から直した履歴の目安） */
  recordedAt: number;
}

/** 瞑想1回ぶんの記録。長さより「やった日」を数えるが、長さも残しておく */
export interface MeditationSession {
  minutes: number;
  recordedAt: number;
}

/** 人との接点の濃さ。氏名は持たない（誰かを記録する機能にしない） */
export type SocialContact = 'deep' | 'light' | 'none';

/**
 * 『最高の体調』由来の1日の記録。
 * どれも「やったかどうか」の記録で、体内の炎症そのものを測るものではない。
 */
export interface ConditionRecord {
  /** その日に食べた発酵食品の種類（数より種類） */
  ferments: string[];
  /** 食物繊維を取れた食品 */
  fibers: string[];
  /** 外で自然に触れた分数 */
  natureMinutes: number;
  /** 室内に取り入れた自然（観葉植物・写真・音） */
  indoorNature: string[];
  social: SocialContact | null;
  anxietyFelt: boolean | null;
  /** 不安への対処（宇宙・大自然・アート・瞑想） */
  anxietyActions: string[];
  /** 睡眠まわりの習慣（ベッドは寝る場所・日中の太陽光・夜は暗く） */
  sleepHygiene: string[];
}

/** 本書の「良質な睡眠の最低条件」を測るための記録 */
export interface SleepQualityRecord {
  /** 眠りに落ちるまでの時間（分） */
  fallAsleepMinutes: number | null;
  /** 夜中に目が覚めた回数 */
  awakenings: number | null;
  /** 目が覚めたあと20分以内に再び眠れたか */
  backToSleepWithin20: boolean | null;
  /** 寝床にいた時間（分） */
  inBedMinutes: number | null;
  /** 実際に眠っていた時間（分） */
  sleptMinutes: number | null;
}

/** その日の食事の記録（時間と量だけ。何をどれだけ食べたかの栄養計算はしない） */
export interface MealRecord {
  /** その日の最初の食事 'HH:MM' */
  firstMealAt: string | null;
  /** その日の最後の食事 'HH:MM' */
  lastMealAt: string | null;
  /** 最後の食事が日付をまたいだか（夜勤明けの深夜の食事） */
  lastMealCrossesMidnight: boolean;
  /** 満腹度。腹八分目で止められたか */
  fullness: 'eight' | 'full' | 'over' | null;
  /** 止めどきのサイン（ふらつき等）。責めるためではなく、休む判断のために持つ */
  signs: string[];
}

/** モンクモードの記録（既存と重なっていない項目だけ） */
export interface MonkRecord {
  waterMl: number;
  electrolyte: boolean;
  steps: number;
  workoutMinutes: number;
  /** 運動した時刻 'HH:MM'（運動後の集中しやすい時間帯を出すのに使う） */
  workoutAt: string | null;
  readingMinutes: number;
  /** 決めたSNSのルールを守れたか */
  snsRuleKept: boolean | null;
  /** 一人で集中した時間（分）。※「人間関係を切る」ではなく時間の確保として持つ */
  soloMinutes: number;
}

export interface DayRecord {
  /** 'YYYY-MM-DD' */
  date: string;
  /** 達成した習慣のid */
  checked: string[];
  /** 今日の宣言 */
  declaration: string;
  /** 学び・振り返りメモ */
  note: string;
  /** 勤務日／休日。未設定は null */
  shift: ShiftKind | null;
  /** その日だけの終業時刻 'HH:MM'（未設定は設定の既定値を使う） */
  shiftEndsAt: string | null;
  sleep: SleepEntry | null;
  /** その日の瞑想（1日に複数回できる）。古いデータには無いので、読む側は空配列を既定にする */
  meditations?: MeditationSession[];
  /** 『最高の体調』の記録。古いデータには無いので、読む側は既定値を用意する */
  condition?: ConditionRecord;
  sleepQuality?: SleepQualityRecord;
  meal?: MealRecord;
  monk?: MonkRecord;
  updatedAt: number;
}

/** 週次振り返り（ステップ⑦）＋3分の2バッファ法の2視点 */
export interface WeeklyReview {
  /** その週の月曜日 'YYYY-MM-DD' */
  weekStart: string;
  good: string;
  improve: string;
  focus: string;
  /** 管理者視点：計画そのものを見る（実行役を責めない） */
  manager: {
    planFollowed: 'yes' | 'partly' | 'no' | null;
    allocation: 'too_much' | 'about_right' | 'too_little' | null;
    note: string;
  };
  /** 実行者視点：やってみた感触と詰まった点 */
  doer: {
    feel: 'good' | 'ok' | 'hard' | null;
    stuck: string;
  };
  updatedAt: number;
}

/**
 * 実践期間（区切り）。
 * ゴーストモードは「最低1ヶ月」「無期限の実践は想定しない」ため、
 * 期間で区切って続けるかどうかを本人が決められるようにする。
 */
export interface Cycle {
  id: string;
  startDate: string;
  lengthDays: number;
  /** 期間の目的（最上位目標）。ステップ②の判断基準になる */
  goal: string;
  endedAt: number | null;
  decision: 'continue' | 'pause' | 'finish' | null;
  closingNote: string;
}

export interface Settings {
  /** 勤務日の既定の終業時刻 'HH:MM'（りらくるは深夜0時前後） */
  shiftEndDefault: string;
  /** 終業から何分以内に就寝するか（ステップ⑤のシフト対応版） */
  bedWithinMinutes: number;
  /** 休日の就寝目標 'HH:MM' */
  offDayBedtime: string;
  /** 音声学習（鍼灸アプリ）への導線を出すか */
  audioLinkEnabled: boolean;
  audioLinkUrl: string;
  /** ストリークを大きく出すか（既定は控えめ＝煽らない） */
  showStreakProminently: boolean;
  /** 瞑想タイマーの終わりに音を鳴らすか */
  meditationBell: boolean;
  /** タイマーの既定の長さ（分） */
  meditationDefaultMinutes: number;

  // ── 食事の時間と量 ──
  /**
   * 前の食事から次の食事まで空ける目標（時間）。
   * 出典は「◯時間以上」としているが、受け取った文字起こしでその数字が欠けていたため、
   * 出典の値としては持たず、アプリの初期値として持つ（利用者が変えられる）。
   */
  fastingTargetHours: number;
  /** 勤務日だけ短くする目標（0で「勤務日も同じ」） */
  fastingWorkdayHours: number;
  /** いま取り組んでいる段階（PLANS の id） */
  fastingPlan: string;
  /** その段階を始めた日 'YYYY-MM-DD' */
  fastingPlanSince: string | null;
  /** 始める前の確認で当てはまった項目 */
  fastingPrechecks: string[];

  // ── モンクモード ──
  monkWaterMl: number;
  monkSteps: number;
  monkWorkoutPerWeek: number;
  /** 選んでいるSNSの制限の仕方（SNS_RULES の id） */
  monkSnsRule: string | null;
  /** 塩・血圧まわりの事前確認で当てはまった項目 */
  monkPrechecks: string[];
}

export interface AppState {
  version: number;
  habits: Habit[];
  days: Record<string, DayRecord>;
  weeks: Record<string, WeeklyReview>;
  cycles: Cycle[];
  settings: Settings;
  /**
   * 3のルール（今日／今週／今月に3つずつ）。
   * キーは threeRules.ts の keyFor が作る（'2026-08-30' / 'w:2026-08-24' / 'm:2026-08'）。
   * 日・週・月で同じ仕組みを使い、3か所に別の実装を持たない。
   */
  threeRules?: Record<string, string[]>;
}
