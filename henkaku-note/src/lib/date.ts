// 日付まわり。すべて「その端末のローカル時刻」で扱う。
// 純粋関数だけを置く（now は必ず引数で受け取る＝テストできるようにする）。

export const DAY_MS = 86_400_000;
/** 週の始まりは月曜（週次振り返りが週末に来るように） */
export const WEEK_STARTS_ON = 1;

export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD' */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → Date（その日の0:00）。不正な文字列は null */
export function fromKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    return null; // 2026-02-31 のような存在しない日
  }
  return d;
}

export function addDays(key: string, days: number): string {
  const d = fromKey(key);
  if (!d) return key;
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** 2つの日付の差（日数）。key の順に関係なく b - a */
export function diffDays(a: string, b: string): number {
  const da = fromKey(a);
  const db = fromKey(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / DAY_MS);
}

/** その日が属する週の月曜日 */
export function startOfWeek(key: string): string {
  const d = fromKey(key);
  if (!d) return key;
  const shift = (d.getDay() - WEEK_STARTS_ON + 7) % 7;
  return addDays(key, -shift);
}

export function endOfWeek(key: string): string {
  return addDays(startOfWeek(key), 6);
}

/** 週の7日分の日付 */
export function weekDays(key: string): string[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * カレンダーの月グリッド（月曜始まり・6週42マス固定）。
 * マスの数を月によって変えると高さが跳ねてタップ位置がずれるため、常に42マス。
 */
export function monthGrid(year: number, month0: number): { key: string; inMonth: boolean }[] {
  const first = new Date(year, month0, 1);
  const start = startOfWeek(toKey(first));
  return Array.from({ length: 42 }, (_, i) => {
    const key = addDays(start, i);
    const d = fromKey(key)!;
    return { key, inMonth: d.getFullYear() === year && d.getMonth() === month0 };
  });
}

/** 'HH:MM' → 0:00からの分。不正なら null */
export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 分 → 'HH:MM'。24時間を超えた分は翌日の時刻として折り返す */
export function toHHMM(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** 24時間を超える分を「翌1:30」のように読める形にする */
export function formatClock(minutes: number): string {
  const next = minutes >= 1440;
  return `${next ? '翌' : ''}${toHHMM(minutes)}`;
}

export function formatDateJa(key: string): string {
  const d = fromKey(key);
  if (!d) return key;
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_LABELS[d.getDay()]}）`;
}

export function formatMonthJa(year: number, month0: number): string {
  return `${year}年${month0 + 1}月`;
}

/** 週の見出し「9月1日〜9月7日」 */
export function formatWeekRangeJa(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const a = fromKey(weekStart);
  const b = fromKey(end);
  if (!a || !b) return weekStart;
  return `${a.getMonth() + 1}月${a.getDate()}日 〜 ${b.getMonth() + 1}月${b.getDate()}日`;
}
