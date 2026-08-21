// 週次振り返り（ステップ⑦）＋ 3分の2バッファ法の2視点。
//
// 3分の2バッファ法（河野ゆかり『「仕組み化」勉強法』の考え方。鍼灸アプリでも同じ考えを使っている）:
//   予定は「基礎タスク：バッファ ＝ 2：1」で組み、埋まらなかったバッファを責めない。
//   振り返りの主語は **実行役ではなくマネージャー**。
//   できなかったのは意志が弱いからではなく、計画が実態に合っていなかったから、と見る。
//
// そのため週次振り返りは2視点に分ける:
//   管理者視点 … 計画そのものを見る（詰め込みすぎていないか・配分は合っていたか）
//   実行者視点 … やってみた感触と、詰まった点
//
// この2視点の文言は一貫して「計画を直す」方向に書く。自己否定を促す言い回しは使わない。

import { weekDays, startOfWeek, diffDays, addDays } from './date.js';
import { completionRate, habitsForDate } from './habits.js';
import { bedtimeSummary } from './shift.js';
import type { DayRecord, Habit, Settings, WeeklyReview } from '../types/index.js';

export const REVIEW_TEXT_MAX = 400;

export const MANAGER_PLAN_OPTIONS = [
  { id: 'yes', label: '計画どおり進んだ' },
  { id: 'partly', label: '半分くらい進んだ' },
  { id: 'no', label: 'ほとんど進まなかった' },
] as const;

export const MANAGER_ALLOCATION_OPTIONS = [
  { id: 'too_much', label: '詰め込みすぎだった', advice: '来週は基礎タスクを2割減らして、空いた分をバッファにしてみてください。' },
  { id: 'about_right', label: 'ちょうどよかった', advice: '同じ配分で続けられます。うまくいった週の組み方をメモに残しておくと再現できます。' },
  { id: 'too_little', label: '余裕がありすぎた', advice: '来週は基礎タスクを少しだけ増やせます。増やすのは1段階だけにしてください。' },
] as const;

export const DOER_FEEL_OPTIONS = [
  { id: 'good', label: '手応えがあった', icon: '🌤' },
  { id: 'ok', label: 'ふつう', icon: '☁️' },
  { id: 'hard', label: 'しんどかった', icon: '🌧' },
] as const;

export function emptyReview(weekStart: string, at: number): WeeklyReview {
  return {
    weekStart: startOfWeek(weekStart),
    good: '',
    improve: '',
    focus: '',
    manager: { planFollowed: null, allocation: null, note: '' },
    doer: { feel: null, stuck: '' },
    updatedAt: at,
  };
}

/** 3項目のうち1つでも書けていれば「振り返りをした」とみなす（完璧を求めない） */
export function isReviewWritten(review: WeeklyReview | undefined): boolean {
  if (!review) return false;
  return Boolean(review.good.trim() || review.improve.trim() || review.focus.trim());
}

/** ステップ⑦（週次振り返り）の習慣に自動でチェックを入れる週かどうか */
export function reviewedWeeks(weeks: Record<string, WeeklyReview>): Set<string> {
  const out = new Set<string>();
  for (const [key, review] of Object.entries(weeks)) {
    if (isReviewWritten(review)) out.add(key);
  }
  return out;
}

export interface WeekSummary {
  weekStart: string;
  days: string[];
  /** 記録がある日数 */
  recordedDays: number;
  /** その週の平均達成率（記録がある日だけを分母にする＝書かなかった日で薄めない） */
  averageRate: number;
  /** 習慣ごとの達成日数 */
  perHabit: { habit: Habit; done: number; possible: number }[];
  /** 一番できた習慣・一番できなかった習慣（材料が足りない時は null） */
  best: Habit | null;
  hardest: Habit | null;
  workDays: number;
  offDays: number;
  bedtime: ReturnType<typeof bedtimeSummary>;
}

/**
 * その週の事実だけを集計する。
 * 「頑張った」「サボった」のような評価はここでは作らない（画面側でも作らない）。
 */
export function buildWeekSummary(
  anyDayInWeek: string,
  days: Record<string, DayRecord>,
  habits: Habit[],
  settings: Settings,
): WeekSummary {
  const keys = weekDays(anyDayInWeek);
  const records = keys.map((k) => days[k]).filter((r): r is DayRecord => Boolean(r));
  const recorded = records.filter((r) => r.checked.length > 0 || r.note.trim() || r.declaration.trim() || r.sleep);

  const rates = recorded.map((r) => completionRate(r, habits));
  const averageRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

  const counts = new Map<string, { done: number; possible: number }>();
  for (const key of keys) {
    const record = days[key];
    for (const h of habitsForDate(habits, key)) {
      const cur = counts.get(h.id) || { done: 0, possible: 0 };
      cur.possible += 1;
      if (record?.checked.includes(h.id)) cur.done += 1;
      counts.set(h.id, cur);
    }
  }
  const perHabit = habits
    .filter((h) => counts.has(h.id))
    .map((h) => ({ habit: h, ...counts.get(h.id)! }))
    .sort((a, b) => b.done - a.done || a.habit.title.localeCompare(b.habit.title, 'ja'));

  // 記録が2日未満だと「一番できた／できなかった」は言えるだけの材料がない
  const enough = recorded.length >= 2 && perHabit.length > 0;
  return {
    weekStart: startOfWeek(anyDayInWeek),
    days: keys,
    recordedDays: recorded.length,
    averageRate,
    perHabit,
    best: enough ? perHabit[0].habit : null,
    hardest: enough ? perHabit[perHabit.length - 1].habit : null,
    workDays: records.filter((r) => r.shift === 'work').length,
    offDays: records.filter((r) => r.shift === 'off').length,
    bedtime: bedtimeSummary(records, settings),
  };
}

/**
 * 管理者視点のヒント。
 * 実績（達成率・勤務日数）と本人の回答から、**計画をどう直すか**を1文で返す。
 * 本人を評価する文は返さない。
 */
export function managerHint(summary: WeekSummary, review: WeeklyReview | undefined): string {
  const allocation = review?.manager.allocation;
  if (allocation) {
    const found = MANAGER_ALLOCATION_OPTIONS.find((o) => o.id === allocation);
    if (found) return found.advice;
  }
  if (summary.recordedDays === 0) return '今週は記録がありません。まずは1日ぶんだけ、チェックを付ける日を決めてみてください。';
  if (summary.workDays >= 5 && summary.averageRate < 0.5) {
    return `勤務が${summary.workDays}日ある週でした。この週に同じ量を置いたこと自体が重かったかもしれません。勤務日は項目を絞る前提で組み直せます。`;
  }
  if (summary.averageRate >= 0.8) return '計画と実態が合っていた週です。この週の組み方をメモに残しておくと、次に再現できます。';
  return '達成できなかった項目は、量ではなく「置いた時間帯」が合っていないことがあります。時間帯を1つ動かすところから試せます。';
}

/** 前の週と比べた変化（増減の事実だけ） */
export function compareWeeks(current: WeekSummary, previous: WeekSummary | null) {
  if (!previous || previous.recordedDays === 0 || current.recordedDays === 0) return null;
  const delta = current.averageRate - previous.averageRate;
  const points = Math.round(Math.abs(delta) * 100);
  if (points < 5) return { delta, text: '先週とほぼ同じペースです。' };
  return {
    delta,
    text: delta > 0 ? `先週より${points}ポイント高いペースです。` : `先週より${points}ポイント低いペースです。`,
  };
}

/**
 * 週次振り返りを書いた時、ステップ⑦のチェックを入れる日。
 * その週の中にいるなら今日、過ぎた週をあとから書いたならその週の最終日に入れる
 * （振り返りは「その週の出来事」なので、書いた日ではなく週の中に残す）。
 */
export function reviewCheckDate(weekStart: string, today: string): string {
  const passed = diffDays(weekStart, today);
  if (passed < 0) return weekStart;          // 未来の週（通常はない）
  if (passed <= 6) return today;             // その週の中
  return addDays(weekStart, 6);              // 過ぎた週 → 日曜に入れる
}

/** その週が「もう振り返れる週」か（週の最終日を過ぎている、または今日が週末） */
export function isWeekReviewable(weekStart: string, today: string): boolean {
  const passed = diffDays(weekStart, today);
  return passed >= 5; // 土曜以降
}
