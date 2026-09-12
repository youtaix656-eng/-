// アプリ全体のデータの形（単一の正）。
// 保存するのは「入力そのもの」だけ。集計（部位別の件数・効果順の並び）は
// 保存せず毎回 lib/ で導く——ロジックを直したときに過去の記録を読み直せるようにするため。

/** 'YYYY-MM-DD'（端末のローカル日付。UTC変換はしない） */
export type DateKey = string;

/** 左右の別 */
export type Side = 'left' | 'right' | 'both' | null;

/** 痛みの強さ（VAS 0〜10。整数） */
export type Vas = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** 発生タイミング（data/timings.ts の id） */
export type TimingId = 'during_treatment' | 'after_treatment' | 'waking' | 'working' | 'other';

/** 対応策の効果の自己評価（4段階。data/effects.ts の id） */
export type EffectId = 'worse' | 'same' | 'better' | 'much_better';

export interface SymptomRecord {
  id: string;
  /** 記録した時刻（epoch ms。自動） */
  at: number;
  /** 体の図でタップした部位（data/bodyRegions.ts の id） */
  regionId: string;
  side: Side;
  vas: Vas;
  timing: TimingId;
  /** timing が 'other' のときの自由記述 */
  timingOther: string;
  /** 専門用語メモ（例：Tinel様所見、硬結の有無） */
  note: string;
}

export interface CareRecord {
  id: string;
  /** 実施日 */
  date: DateKey;
  /** 記録した時刻（epoch ms。並び替え用） */
  at: number;
  /** 実施したケア内容（クイック選択の項目名と自由入力を合わせた本文） */
  content: string;
  effect: EffectId;
  /** どの症状に対する対応策か（SymptomRecord.id。複数可・無しも可） */
  symptomIds: string[];
}

export interface Settings {
  /** クイック選択に出すケア項目（並び順のまま表示。data/quickCare.ts の初期値から編集できる） */
  quickCareItems: string[];
  lastView: string;
}

export interface AppState {
  version: number;
  symptoms: SymptomRecord[];
  cares: CareRecord[];
  settings: Settings;
}
