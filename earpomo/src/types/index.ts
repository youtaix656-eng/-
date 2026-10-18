// アプリ全体のデータの形（単一の正）。
// 保存するのは「入力そのもの」と「タイマーの現在地」だけで、
// 集計（合計時間・連続日数・完了数）は保存しない——ロジックを直しても過去の記録を読み直せるようにするため。

/** 'YYYY-MM-DD'（端末のローカル日付。UTC変換はしない） */
export type DateKey = string;

/** 'HH:mm' */
export type TimeKey = string;

export interface Preset {
  id: string;
  name: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** 長い休憩までの集中回数 */
  sessionsCount: number;
}

export type Phase = 'focus' | 'short' | 'long';
export type TimerStatus = 'idle' | 'running' | 'paused';

/**
 * タイマーの現在地。
 * ⚠ 残り時間は「終わる時刻（endAt）から毎回引き算」で求める（1秒ずつ減らさない）。
 *    タブが裏に回って止まっても、戻った時に正しい残り時間になる。
 */
export interface TimerState {
  phase: Phase;
  /** 今の周期の中で何回目の集中か（0始まり） */
  pomoIndex: number;
  status: TimerStatus;
  /** running のときだけ。終わる予定の時刻（epoch ms） */
  endAt: number | null;
  /** paused / idle のときの残り（ms） */
  remainingMs: number;
  /** この局面の長さ（ms） */
  durationMs: number;
  /** 集中を始めた時刻（記録用。休憩では null） */
  startedAt: number | null;
  /** 集中のタグ（作業内容）。未選択は null */
  tag: string | null;
}

export interface SessionRecord {
  id: string;
  date: DateKey;
  startedAt: number;
  durationMinutes: number;
  tag: string | null;
  /** 最後まで集中できたか（スキップした時は false） */
  completed: boolean;
}

export type ScheduleType = 'work' | 'school' | 'other';
export type RepeatKind = 'none' | 'daily' | 'weekly' | 'weekdays';

export interface ScheduleEntry {
  id: string;
  type: ScheduleType;
  date: DateKey;
  startTime: TimeKey;
  endTime: TimeKey;
  repeat: RepeatKind;
  memo: string;
}

export interface ExamDate {
  id: string;
  name: string;
  date: DateKey;
}

/** 追加済みの曲（音声そのものは storage の別の場所に blob で持つ） */
export interface BgmTrack {
  id: string;
  name: string;
  /** 秒。読めなかった時は null */
  durationSec: number | null;
  sizeBytes: number;
  addedAt: number;
}

export type SoundId = 'none' | 'bell' | 'soft' | 'wood' | 'chime';

export interface Settings {
  startSound: SoundId;
  endSound: SoundId;
  vibrate: boolean;
  /** 集中→休憩→集中 を自動で進めるか */
  autoContinue: boolean;
  /** 選択中のBGM。null は「無音のまま集中する」 */
  bgmId: string | null;
  /** 0〜1 */
  bgmVolume: number;
  /** 自動で確かめられない端末で、本人が「イヤホンをつけている」と確認した印 */
  headphoneConfirmed: boolean;
  /** 走っている間だけ画面を眠らせない（Wake Lock） */
  keepAwake: boolean;
  /** 裏に回っている時、局面の終わりを端末通知で知らせる */
  notify: boolean;
  lastView: string;
}

export interface AppState {
  version: number;
  presets: Preset[];
  activePresetId: string;
  timer: TimerState;
  records: SessionRecord[];
  schedule: ScheduleEntry[];
  exams: ExamDate[];
  bgm: BgmTrack[];
  settings: Settings;
}
