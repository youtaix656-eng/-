// アプリ全体のデータの形（単一の正）。
// 保存するのは「入力そのもの」だけで、判定結果（レベル・バッジ・最長記録）は
// 保存しない——ロジックを直したときに過去の記録を読み直せるようにするため。

/** 'YYYY-MM-DD'（端末のローカル日付。UTC変換はしない） */
export type DateKey = string;

/** 5段階の記録。未入力は null（0にしない＝「答えていない」を「最低」と読ませない） */
export type Scale5 = 1 | 2 | 3 | 4 | 5 | null;

export interface Relapse {
  id: string;
  /** リラプスした時刻（epoch ms） */
  at: number;
  /** そのとき終わった継続の開始時刻（epoch ms）。日数は毎回ここから導く */
  startedAt: number;
  /** きっかけ（triggers.ts の id。自由記述は note へ） */
  triggers: string[];
  note: string;
}

export interface DayRecord {
  date: DateKey;
  /** 体調 */
  body: Scale5;
  /** 集中力 */
  focus: Scale5;
  /** 気分 */
  mood: Scale5;
  /** その日の気づき（ジャーナリング） */
  journal: string;
  updatedAt: number;
}

/** 緊急ボタンを押した記録（衝動の波がいつ来るかを見るためだけに持つ） */
export interface UrgeLog {
  id: string;
  at: number;
  /** 冷却タイマーを何秒動かしたか */
  seconds: number;
  /** 最後まで動かせたか。押しただけで閉じた場合は false */
  finished: boolean;
}

export interface Settings {
  /** チャクラレベルの境界日数（7段階ぶんの下限。昇順・先頭は必ず0） */
  levelThresholds: number[];
  /** 冷却タイマーの長さ（秒） */
  coolDownSeconds: number;
  /** 瞑想タイマーの既定の長さ（分） */
  meditationMinutes: number;
  /** 開始・終了の合図音（端末内で合成する。音声ファイルは持たない） */
  bell: boolean;
  /** PIN のハッシュ（平文は保存しない）。null ならロックなし */
  pinHash: string | null;
  /** PIN のハッシュに使った方式（'sha256' か、使えない端末向けの 'fallback'） */
  pinKind: 'sha256' | 'fallback' | null;
  /** 表示名の偽装 */
  disguiseEnabled: boolean;
  disguiseTitle: string;
  disguiseIcon: string;
  /** 直近に見ていた画面（次に開いたとき同じ場所から） */
  lastView: string;
}

export interface AppState {
  version: number;
  /** いまの継続の開始時刻（epoch ms）。null＝まだ始めていない */
  startedAt: number | null;
  relapses: Relapse[];
  days: Record<DateKey, DayRecord>;
  urges: UrgeLog[];
  settings: Settings;
}
