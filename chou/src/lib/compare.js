// ふりかえりの「並べる」層（提案7〜12）。
//
// **このアプリでいちばん壊しやすい所**（README 決まり3）。
//
// 決めていること
//  - **矢印を書かない。** ここが返すのは「同じ期間に並んでいた日数」までで、
//    「◯を食べたから△になった」は返さないし、画面にも書かない。
//  - **割合を先に見せない。** 出すのは「◯日のうち◯日」——分母を隠すと、
//    2日のうち1日が「50パーセント」になって、たまたまが法則に見える。
//  - **少なすぎるものは並べない**（`MIN_DAYS_EACH`）。片方が1〜2日しかない比べは、
//    何も言っていないのと同じ。足りない時は**黙らず**「あと何日ぶん要るか」を出す。
//  - **順位を付けない・良し悪しを言わない**（決まり1・2）。増えた・減ったまで。

import { BELLY_BY_ID, LEVELS, EXERCISE_STEPS, SLEEP_STEPS, POSTURE_STEPS, WATER_STEPS } from '../data/scales.js';
import { hasRecord, foodsOfDay } from './days.js';
import { lastKeys, shiftKey, rangeKeys, todayKey, diffDays, parseKey } from './dates.js';

/** 片方につき、これだけ日数が無ければ並べない */
export const MIN_DAYS_EACH = 3;

/** つらいほうの段だった日か（`stats.hardBellyDays` と同じ線引き） */
export function isHardDay(day) {
  const belly = day && day.belly;
  return Boolean(belly && BELLY_BY_ID[belly] && BELLY_BY_ID[belly].order >= 4);
}

/** お腹の段を書いた日か（分母をそろえるため、書いていない日は数えない） */
function hasBelly(day) {
  return Boolean(day && day.belly && BELLY_BY_ID[day.belly]);
}

function tally(days, keys) {
  let recorded = 0;
  let hard = 0;
  let stools = 0;
  for (const key of keys) {
    const day = (days || {})[key];
    if (!hasBelly(day)) continue;
    recorded += 1;
    if (isHardDay(day)) hard += 1;
    stools += day.stools.length;
  }
  return { days: recorded, hard, stools };
}

// ───────────────────── 7. 食べた日／食べなかった日 ─────────────────────

/**
 * ひとつの食べものについて、**食べた日と食べなかった日を並べる**。
 * 返すのは日数だけで、どちらが良い・悪いは言わない。
 */
export function foodCompare(days, keys, food) {
  const withKeys = [];
  const withoutKeys = [];
  for (const key of keys) {
    const day = (days || {})[key];
    if (!hasBelly(day)) continue;
    if (foodsOfDay(day).includes(food)) withKeys.push(key);
    else withoutKeys.push(key);
  }
  const withSide = tally(days, withKeys);
  const withoutSide = tally(days, withoutKeys);
  const enough = withSide.days >= MIN_DAYS_EACH && withoutSide.days >= MIN_DAYS_EACH;
  const short = Math.max(
    MIN_DAYS_EACH - withSide.days,
    MIN_DAYS_EACH - withoutSide.days,
    0,
  );
  return { food, with: withSide, without: withoutSide, enough, short };
}

/** 並べられるものだけを返す（**足りないものは出さない**） */
export function foodCompareList(days, keys, foods, limit = 8) {
  return (foods || [])
    .map((food) => foodCompare(days, keys, food))
    .filter((row) => row.enough)
    .slice(0, limit);
}

/** 並べられない時に、黙らずに出す一言 */
export function compareStatus(rows, candidates) {
  if (rows.length > 0) return '';
  if (!candidates || candidates.length === 0) {
    return 'たべものを書いた日がまだ少ないので、並べられません。';
  }
  return `食べた日・食べなかった日が、それぞれ${MIN_DAYS_EACH}日ぶん貯まると並べられます。`;
}

export const FOOD_COMPARE_NOTE =
  'ここに出ているのは「同じ日に並んでいた」というだけで、その食べものが原因だという意味ではありません。'
  + 'お腹の調子は、食べたもの以外にもいろいろで動きます。気になるものがあれば、'
  + '「ためしにやめてみる」で一度だけ確かめるほうが確かです。';

// ───────────────────── 8. 曜日ごと ─────────────────────

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/** 曜日ごとに並べる。**平日／休日をアプリが決めない**（見るのは本人） */
export function byWeekday(days, keys) {
  const buckets = WEEKDAY_LABELS.map((label, w) => ({ w, label, keys: [] }));
  for (const key of keys) {
    const p = parseKey(key);
    if (!p) continue;
    const w = new Date(p.y, p.m - 1, p.d, 12).getDay();
    buckets[w].keys.push(key);
  }
  return buckets.map((b) => ({ w: b.w, label: b.label, ...tally(days, b.keys) }));
}

export const WEEKDAY_NOTE =
  '曜日で並べただけです。仕事の日と休みの日で違って見えることがありますが、'
  + '曜日そのものが理由ではありません。';

// ───────────────────── 9. 暮らしとお腹を重ねる ─────────────────────

const LIFE_AXES = [
  { id: 'stress', label: 'ストレス', steps: LEVELS },
  { id: 'sleep', label: '眠れたか', steps: SLEEP_STEPS },
  { id: 'exercise', label: '体を動かした', steps: EXERCISE_STEPS },
  { id: 'posture', label: '姿勢', steps: POSTURE_STEPS },
  { id: 'water', label: '水分', steps: WATER_STEPS },
];

/**
 * 暮らしの段ごとに、お腹の段を重ねて並べる。
 * **段の間に順序の意味を持ち込まない**——並べるのは日数だけ。
 */
export function lifeOverlay(days, keys) {
  return LIFE_AXES.map((axis) => {
    const rows = axis.steps.map((step) => {
      const hit = keys.filter((key) => {
        const day = (days || {})[key];
        return hasBelly(day) && day[axis.id] === step.id;
      });
      return { id: step.id, label: step.label, ...tally(days, hit) };
    }).filter((row) => row.days > 0);
    const total = rows.reduce((n, r) => n + r.days, 0);
    return { id: axis.id, label: axis.label, rows, total, enough: total >= MIN_DAYS_EACH };
  }).filter((axis) => axis.rows.length > 0);
}

export const LIFE_OVERLAY_NOTE =
  '同じ日に並んでいたものを重ねているだけです。どちらが先かも、原因かどうかも分かりません。';

// ───────────────────── 10. 前の期間と比べる ─────────────────────

/**
 * 直近 n 日と、そのひとつ前の n 日を並べる。
 * **良くなった・悪くなったと書かない**（増えた・減っただけ）。
 */
export function windowCompare(days, n = 14, today = todayKey()) {
  const nowKeys = lastKeys(n, today);
  const prevEnd = shiftKey(nowKeys[0], -1);
  const prevStart = shiftKey(prevEnd, -(n - 1));
  const prevKeys = rangeKeys(prevStart, prevEnd);
  const now = tally(days, nowKeys);
  const before = tally(days, prevKeys);
  const filled = {
    now: nowKeys.filter((k) => hasRecord((days || {})[k])).length,
    before: prevKeys.filter((k) => hasRecord((days || {})[k])).length,
  };
  return {
    n,
    nowRange: [nowKeys[0], nowKeys[nowKeys.length - 1]],
    beforeRange: [prevStart, prevEnd],
    now,
    before,
    filled,
    enough: now.days >= MIN_DAYS_EACH && before.days >= MIN_DAYS_EACH,
  };
}

export const WINDOW_NOTE =
  '2つの期間を並べているだけです。記録した日数が違えば数も違って見えるので、'
  + '「増えた・減った」をそのまま「良くなった・悪くなった」と読まないでください。';

// ───────────────────── 11. やめてみた前後 ─────────────────────

/**
 * ためしにやめてみた期間の前と、その期間中を並べる。
 * **「よくなりましたか」とは聞かない**（決まり43）——並べるところまで。
 */
export function eliminationCompare(days, elimination, today = todayKey()) {
  if (!elimination || !parseKey(elimination.startedOn)) return null;
  const start = elimination.startedOn;
  const end = elimination.endedOn && parseKey(elimination.endedOn) ? elimination.endedOn : today;
  const duringKeys = rangeKeys(start, end);
  const span = Math.max(1, duringKeys.length);
  const beforeEnd = shiftKey(start, -1);
  const beforeStart = shiftKey(beforeEnd, -(span - 1));
  const beforeKeys = rangeKeys(beforeStart, beforeEnd);
  const during = tally(days, duringKeys);
  const before = tally(days, beforeKeys);
  return {
    targetId: elimination.targetId,
    span,
    duringRange: [start, end],
    beforeRange: [beforeStart, beforeEnd],
    during,
    before,
    enough: during.days >= MIN_DAYS_EACH && before.days >= MIN_DAYS_EACH,
  };
}

export const ELIMINATION_COMPARE_NOTE =
  'やめていた期間と、その前の同じ長さの期間を並べています。'
  + '数が変わっていても、やめたものが理由とは限りません（季節・仕事・薬でも動きます）。'
  + '確かめたいときは、一度もとに戻して、また変わるかを見てください。';

// ───────────────────── 12. 整腸剤を試している期間 ─────────────────────

/**
 * 整腸剤を飲みはじめた日の前後を並べる。
 * **効いたかは判定しない**（決まり19）。飲んだ印を付けた日数も一緒に出す。
 */
export function probioticOverlay(days, probiotic, today = todayKey()) {
  if (!probiotic || !probiotic.name || !parseKey(probiotic.startedOn)) return null;
  const start = probiotic.startedOn;
  const span = Math.max(1, diffDays(start, today) + 1);
  const sinceKeys = rangeKeys(start, today);
  const beforeEnd = shiftKey(start, -1);
  const beforeStart = shiftKey(beforeEnd, -(span - 1));
  const beforeKeys = rangeKeys(beforeStart, beforeEnd);
  const takenDays = sinceKeys.filter((k) => (days || {})[k] && (days || {})[k].probiotic).length;
  const since = tally(days, sinceKeys);
  const before = tally(days, beforeKeys);
  return {
    name: probiotic.name,
    span,
    takenDays,
    sinceRange: [start, today],
    beforeRange: [beforeStart, beforeEnd],
    since,
    before,
    enough: since.days >= MIN_DAYS_EACH && before.days >= MIN_DAYS_EACH,
  };
}

export const PROBIOTIC_OVERLAY_NOTE =
  '飲みはじめた日の前後を並べています。効いたかどうかは、この数字では決まりません。'
  + '飲めなかった日を数えて責める目的でもありません。';
