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
}

export interface AppState {
  version: number;
  habits: Habit[];
  days: Record<string, DayRecord>;
  weeks: Record<string, WeeklyReview>;
  cycles: Cycle[];
  settings: Settings;
}
