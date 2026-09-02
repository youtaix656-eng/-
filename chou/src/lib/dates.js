// 日付は「YYYY-MM-DD」の文字列で持つ。
//
// **`toISOString()` と `new Date('YYYY-MM-DD')` を使わない。**
// どちらも UTC で解釈されるので、日本時間の午前0時が前日になる
// （このリポジトリの他アプリで実際に踏んでいる）。
// 組み立ては getFullYear/getMonth/getDate、読み取りは数値3つへの分解で行う。

const pad = (n) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD'（端末のローカル日付） */
export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 今日のキー */
export function todayKey(now = new Date()) {
  return toKey(now);
}

/** 'YYYY-MM-DD' → { y, m, d }。形が違えば null */
export function parseKey(key) {
  if (typeof key !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** 'YYYY-MM-DD' → ローカルの Date（正午に置く。夏時間や丸めで前後の日へずれないため） */
export function toDate(key) {
  const p = parseKey(key);
  if (!p) return null;
  return new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
}

/** キーを days 日ずらす（負の数で過去へ） */
export function shiftKey(key, days) {
  const base = toDate(key);
  if (!base) return key;
  base.setDate(base.getDate() + days);
  return toKey(base);
}

/** from から to まで（両端を含む）のキーを古い順に返す */
export function rangeKeys(from, to) {
  const out = [];
  if (!parseKey(from) || !parseKey(to)) return out;
  let cur = from;
  // 上限を置くのは、壊れた入力で無限ループにしないため
  for (let i = 0; i < 4000 && cur <= to; i += 1) {
    out.push(cur);
    cur = shiftKey(cur, 1);
  }
  return out;
}

/** 直近 n 日ぶんのキー（今日を含む・古い順） */
export function lastKeys(n, endKey) {
  const end = endKey || todayKey();
  const start = shiftKey(end, -(Math.max(1, n) - 1));
  return rangeKeys(start, end);
}

/** キーの差（日数）。to - from */
export function diffDays(from, to) {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 画面に出す形（2026年9月2日（水）） */
export function formatKey(key, { withYear = true } = {}) {
  const p = parseKey(key);
  if (!p) return '';
  const date = toDate(key);
  const w = WEEKDAYS[date.getDay()];
  return `${withYear ? `${p.y}年` : ''}${p.m}月${p.d}日（${w}）`;
}

/** 短い形（9/2） */
export function formatShort(key) {
  const p = parseKey(key);
  if (!p) return '';
  return `${p.m}/${p.d}`;
}

/** その月の1日のキー */
export function monthStart(key) {
  const p = parseKey(key);
  if (!p) return key;
  return `${p.y}-${pad(p.m)}-01`;
}

/** 月を n か月ずらす（日は1日に置く） */
export function shiftMonth(key, n) {
  const p = parseKey(key);
  if (!p) return key;
  const d = new Date(p.y, p.m - 1 + n, 1, 12, 0, 0, 0);
  return toKey(d);
}

/** その月の日数 */
export function daysInMonth(key) {
  const p = parseKey(key);
  if (!p) return 0;
  return new Date(p.y, p.m, 0).getDate();
}

/** 「HH:MM」。時刻の既定値（今）を作る */
export function nowTime(now = new Date()) {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** 時刻の並べ替え用（不正な値は末尾へ） */
export function timeOrder(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
  if (!m) return 99999;
  return Number(m[1]) * 60 + Number(m[2]);
}
