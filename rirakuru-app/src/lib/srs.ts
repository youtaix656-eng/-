// ============================================================
// 間隔反復（エビングハウスの忘却曲線に沿った復習）エンジン
//
// 一問一答・○×問題・自主基準テストの全問題を共通のIDで管理し、
// 「間違えた／自信がない」問題は間隔を短くリセットして繰り返し出題、
// 「完璧」を既定回数（連続）で正解して初めて“マスター”として卒業させる。
// 一度でも間違えると、その後正解しても連続記録は0からやり直しになる
// ＝正解不正解に関わらず、完全に理解しきるまで復習対象に残り続ける。
// ============================================================
import { readJSON, writeJSON, STORAGE_KEYS } from "./storage";

/** ○△✕ の自己評価（○=完璧・自信あり／△=解説がわからない／✕=答えも解説もわからない） */
export type Grade = "good" | "hard" | "again";

export type ReviewState = {
  /** 現在の間隔（日数） */
  intervalDays: number;
  /** 連続で「good」評価だった回数 */
  streak: number;
  /** 次回に出題してよい日時（ISO文字列） */
  dueAt: string;
  /** 直近の評価 */
  lastGrade: Grade;
  /** 直近に復習した日時 */
  lastReviewedAt: string;
  /** マスター済み（もう出題しない）か */
  mastered: boolean;
  /** これまでの復習回数 */
  reviewCount: number;
  /** 一度でも間違えた／自信なしと評価したことがあるか */
  everStruggled: boolean;
};

export type ReviewMap = Record<string, ReviewState>;

// 復習間隔（日）。連続正解のたびに次のステップへ進む。
const INTERVAL_STEPS = [1, 2, 4, 7, 14, 30, 60];
// この回数だけ連続で「good」評価が続いたらマスター済みとする。
const MASTER_STREAK = 5;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

// 間違えた直後の「短い間隔」（分）。0にすると全問が同時に積み上がって
// 一気に出てしまうため、少し間隔をあけてから再度出題する。
const RELEARN_MINUTES = 10;

/** 現在の状態と評価から、次の ReviewState を計算する */
export function nextReviewState(
  prev: ReviewState | undefined,
  grade: Grade
): ReviewState {
  const now = new Date();

  if (grade !== "good") {
    // 間違い・自信なし：連続記録をリセットし、少し間隔をあけてから
    // 復習対象にする（エビングハウスの忘却曲線は直後の忘却が最も早いが、
    //   間隔ゼロで同じ問題を繰り返すと定着しにくいため、短い間隔を挟む）。
    // 「今すぐ全部見たい／聞きたい」は問題一覧（苦手リスト）側で対応する。
    return {
      intervalDays: 1,
      streak: 0,
      dueAt: addMinutes(now, RELEARN_MINUTES).toISOString(),
      lastGrade: grade,
      lastReviewedAt: now.toISOString(),
      mastered: false,
      reviewCount: (prev?.reviewCount ?? 0) + 1,
      everStruggled: true,
    };
  }

  const streak = (prev?.streak ?? 0) + 1;
  const intervalDays = INTERVAL_STEPS[Math.min(streak - 1, INTERVAL_STEPS.length - 1)];
  const mastered = streak >= MASTER_STREAK;

  return {
    intervalDays,
    streak,
    dueAt: addDays(now, intervalDays).toISOString(),
    lastGrade: grade,
    lastReviewedAt: now.toISOString(),
    mastered,
    reviewCount: (prev?.reviewCount ?? 0) + 1,
    everStruggled: prev?.everStruggled ?? false,
  };
}

/** 復習状態マップを読み出す */
export function readReviewMap(): ReviewMap {
  return readJSON<ReviewMap>(STORAGE_KEYS.srs, {});
}

/** 1問分の評価を保存する（呼ぶだけで永続化まで完了） */
export function gradeItem(id: string, grade: Grade): ReviewMap {
  const map = readReviewMap();
  map[id] = nextReviewState(map[id], grade);
  writeJSON(STORAGE_KEYS.srs, map);
  return map;
}

/** 正誤（true/false）から自動的に good / again を判定して保存する（○×・テスト用） */
export function gradeByCorrectness(id: string, correct: boolean): ReviewMap {
  return gradeItem(id, correct ? "good" : "again");
}

/** 今すぐ復習すべき問題かどうか（一度でも学習済み・マスター前・期日到来） */
export function isDue(map: ReviewMap, id: string, now: Date = new Date()): boolean {
  const s = map[id];
  if (!s) return false; // 未学習はここでは対象外（初出はクイズ/テスト側で学ぶ）
  if (s.mastered) return false;
  return new Date(s.dueAt).getTime() <= now.getTime();
}

/** マスター済みかどうか */
export function isMastered(map: ReviewMap, id: string): boolean {
  return !!map[id]?.mastered;
}

/** 一度でも間違えた（again/hard評価がある）かどうか */
export function hasStruggled(map: ReviewMap, id: string): boolean {
  return !!map[id]?.everStruggled;
}
