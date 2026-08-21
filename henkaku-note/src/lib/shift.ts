// ステップ⑤「就寝ルール」のシフト対応版。
//
// 原典は「夜11時就寝」だが、りらくるの夜勤は終業が深夜0時前後で、そのままでは守れない。
// そこで **終業時刻を基準に就寝目標を動的に計算する**。
//
//   勤務日 : 終業時刻 ＋ bedWithinMinutes（既定90分）
//   休日   : 固定の目標時刻（既定 23:00）
//
// 時刻はすべて「その日の 0:00 からの分」で扱う。
// 終業が 00:00（＝日付が変わった直後）の場合、就寝目標は 01:30 になり 1440 を超える。
// 24時間を超えた分はそのまま返し、表示側が formatClock で「翌01:30」と読ませる。
// 分をそのまま比較できるので、日付をまたぐ判定を特別扱いしなくて済む。

import { toMinutes, toHHMM, formatClock } from './date.js';
import type { DayRecord, Settings, SleepEntry } from '../types/index.js';

/** 勤務終了が「日付が変わったあと」なら、その日の続きとして扱う分に直す */
const AFTER_MIDNIGHT_LIMIT = 12 * 60; // 12:00 より前の時刻は翌日扱い

/**
 * 勤務終了時刻を、その日の0:00からの分に直す。
 * 例) '00:00' → 1440（＝翌0:00）、'23:30' → 1410、'01:00' → 1500
 * 深夜勤務は「その日の終業」が暦の上では翌日になるため。
 */
export function shiftEndMinutes(hhmm: string): number | null {
  const m = toMinutes(hhmm);
  if (m === null) return null;
  return m < AFTER_MIDNIGHT_LIMIT ? m + 1440 : m;
}

export interface BedtimeTarget {
  /** その日の0:00からの分（1440以上なら翌日） */
  minutes: number;
  /** 表示用（'翌01:30' など） */
  label: string;
  /** 目標の根拠（画面に出して、なぜこの時刻かが分かるようにする） */
  reason: string;
  basis: 'work' | 'off';
}

/**
 * その日の就寝目標時刻。シフト未設定の日は目標を作らない
 * （勤務か休みか分からないまま目標だけ出すと、守れない目標が並ぶため）。
 */
export function bedtimeTarget(record: Pick<DayRecord, 'shift' | 'shiftEndsAt'> | undefined, settings: Settings): BedtimeTarget | null {
  if (!record || record.shift === null) return null;

  if (record.shift === 'off') {
    const m = toMinutes(settings.offDayBedtime);
    if (m === null) return null;
    return {
      minutes: m,
      label: formatClock(m),
      reason: `休日の就寝目標（設定：${settings.offDayBedtime}）`,
      basis: 'off',
    };
  }

  const endsAt = record.shiftEndsAt || settings.shiftEndDefault;
  const end = shiftEndMinutes(endsAt);
  if (end === null) return null;
  const minutes = end + Math.max(0, settings.bedWithinMinutes);
  return {
    minutes,
    label: formatClock(minutes),
    reason: `終業 ${formatClock(end)} ＋ ${settings.bedWithinMinutes}分`,
    basis: 'work',
  };
}

/** 就寝実績を、その日の0:00からの分に直す */
export function sleepMinutes(entry: SleepEntry): number | null {
  const m = toMinutes(entry.actualAt);
  if (m === null) return null;
  return entry.crossesMidnight ? m + 1440 : m;
}

/**
 * 入力された時刻から「日付をまたいだか」を推定する。
 * 目標が翌日にある日（夜勤明けなど）に 01:30 と入れたら、まず翌日のつもりのはず。
 * 推定はあくまで初期値で、画面側でトグルして直せるようにする。
 */
export function guessCrossesMidnight(actualAt: string, target: BedtimeTarget | null): boolean {
  const m = toMinutes(actualAt);
  if (m === null) return false;
  if (m >= AFTER_MIDNIGHT_LIMIT) return false; // 昼以降の時刻は当日
  if (target && target.minutes >= 1440) return true; // 目標が翌日なら翌日のつもり
  return true; // 0:00〜11:59 はその日の夜からの続きとみなす
}

export type BedtimeVerdict = 'met' | 'late' | 'unknown';

export interface BedtimeResult {
  verdict: BedtimeVerdict;
  /** 目標に対する差（分）。プラスは超過 */
  diffMinutes: number | null;
  text: string;
}

/**
 * 就寝目標に対する判定。
 * 責める書き方はしない（守れなかった日を責めても次の日は変わらないため、
 * 「何分ずれたか」という事実だけを返す）。
 */
export function judgeBedtime(record: DayRecord | undefined, settings: Settings): BedtimeResult {
  const target = bedtimeTarget(record, settings);
  if (!target || !record?.sleep) return { verdict: 'unknown', diffMinutes: null, text: '就寝の記録はまだありません。' };
  const actual = sleepMinutes(record.sleep);
  if (actual === null) return { verdict: 'unknown', diffMinutes: null, text: '就寝時刻を読み取れませんでした。' };
  const diff = actual - target.minutes;
  if (diff <= 0) {
    return {
      verdict: 'met',
      diffMinutes: diff,
      text: diff === 0 ? '目標ちょうどに就寝できました。' : `目標より${-diff}分早く就寝できました。`,
    };
  }
  return { verdict: 'late', diffMinutes: diff, text: `目標より${diff}分あとの就寝でした。` };
}

/** 期間内の就寝目標の達成状況（週次振り返り・設定画面の集計用） */
export function bedtimeSummary(records: DayRecord[], settings: Settings) {
  let planned = 0;
  let met = 0;
  let late = 0;
  let totalLateMinutes = 0;
  for (const r of records) {
    if (!r.shift) continue;
    planned += 1;
    const v = judgeBedtime(r, settings);
    if (v.verdict === 'met') met += 1;
    else if (v.verdict === 'late') {
      late += 1;
      totalLateMinutes += v.diffMinutes ?? 0;
    }
  }
  return {
    planned,
    met,
    late,
    recorded: met + late,
    averageLateMinutes: late > 0 ? Math.round(totalLateMinutes / late) : 0,
  };
}

/**
 * 分割睡眠トラッカー（/sleep-tracker）へ渡せる形。
 * 将来つなぐ時にこの形をそのまま渡せるよう、就寝実績は日付＋ISO風の時刻で保持できるようにしておく。
 * ここではネットワークもストレージも触らない（純粋な変換だけ）。
 */
export interface SleepHandoff {
  date: string;
  bedAt: string;
  targetAt: string | null;
  metTarget: boolean | null;
  source: 'henkaku-note';
}

export function toSleepHandoff(record: DayRecord, settings: Settings): SleepHandoff | null {
  if (!record.sleep) return null;
  const actual = sleepMinutes(record.sleep);
  if (actual === null) return null;
  const target = bedtimeTarget(record, settings);
  const v = judgeBedtime(record, settings);
  return {
    date: record.date,
    bedAt: `${record.sleep.crossesMidnight ? '+1 ' : ''}${toHHMM(actual)}`,
    targetAt: target ? `${target.minutes >= 1440 ? '+1 ' : ''}${toHHMM(target.minutes)}` : null,
    metTarget: v.verdict === 'unknown' ? null : v.verdict === 'met',
    source: 'henkaku-note',
  };
}
