// 記録を「並べて見せる」ための集計。
//
// 決めていること
//  1. **平均を出さない。** お腹の段の平均は点数そのものだし、ブリストルの平均は
//     1と7が1回ずつの日を「ふつうが1回」に見せてしまう。出すのは**分布**と**回数**だけ。
//  2. **相関を因果として書かない。** ここが返すのは「同じ期間に並んでいたもの」までで、
//     「◯を食べたから△になった」は言わない（画面の文言でも言わない）。
//  3. **1日だけのものを「よく」と呼ばない**（`MIN_FOOD_DAYS`）。1回は重なりではない。

import {
  BELLY_STEPS,
  BELLY_BY_ID,
  BRISTOL_GROUPS,
  bristolGroupOf,
  LEVELS,
  EXERCISE_STEPS,
  SLEEP_STEPS,
  POSTURE_STEPS,
} from '../data/scales.js';
import { hasRecord, recordedKeys, foodsOfDay } from './days.js';

/** 「よく食べていたもの」に出すための下限（これ未満は出さない） */
export const MIN_FOOD_DAYS = 2;

/** 通算の記録日数（連続日数は数えない。README 決まり5） */
export function recordedTotal(days) {
  return recordedKeys(days).length;
}

/** 期間の埋まり具合。`marks` はカレンダー帯やドットの並び用 */
export function fillOf(days, keys) {
  const marks = keys.map((k) => hasRecord(days[k]));
  return { done: marks.filter(Boolean).length, total: keys.length, marks };
}

/** お腹の段ごとの日数 */
export function bellyCounts(days, keys) {
  const counts = Object.fromEntries(BELLY_STEPS.map((s) => [s.id, 0]));
  let recorded = 0;
  for (const key of keys) {
    const belly = days[key] && days[key].belly;
    if (belly && counts[belly] !== undefined) {
      counts[belly] += 1;
      recorded += 1;
    }
  }
  return { counts, recorded };
}

/** ブリストルの分布（回数）。まとまりごとと、1〜7それぞれと */
export function bristolCounts(days, keys) {
  const byGroup = Object.fromEntries(BRISTOL_GROUPS.map((g) => [g.id, 0]));
  const byNumber = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [n, 0]));
  let total = 0;
  let unknown = 0;
  for (const key of keys) {
    const day = days[key];
    if (!day) continue;
    for (const stool of day.stools) {
      total += 1;
      if (!stool.bristol) {
        unknown += 1;
        continue;
      }
      byNumber[stool.bristol] += 1;
      const group = bristolGroupOf(stool.bristol);
      if (group) byGroup[group] += 1;
    }
  }
  return { byGroup, byNumber, total, unknown };
}

/** 1日あたりの回数の幅（平均ではなく最小〜最大。記録した日だけを見る） */
export function stoolPerDay(days, keys) {
  const counts = keys.filter((k) => hasRecord(days[k])).map((k) => days[k].stools.length);
  if (!counts.length) return null;
  return { min: Math.min(...counts), max: Math.max(...counts), daysCounted: counts.length };
}

/** 印（間に合わない感じ・血が混じった…）が付いた日数 */
export function markDays(days, keys) {
  const out = {};
  for (const key of keys) {
    const day = days[key];
    if (!day) continue;
    const found = new Set();
    for (const stool of day.stools) for (const mark of stool.marks) found.add(mark);
    for (const mark of found) out[mark] = (out[mark] || 0) + 1;
  }
  return out;
}

/** お腹がつらかった日数（つらい・とてもつらい） */
export function hardBellyDays(days, keys) {
  return keys.filter((k) => {
    const belly = days[k] && days[k].belly;
    return belly && BELLY_BY_ID[belly] && BELLY_BY_ID[belly].order >= 4;
  }).length;
}

/**
 * よく食べていたもの（日数で数える）。
 * **順位は付けるが、お腹の調子とは結ばない。** 結ぶのは本人。
 */
export function topFoods(days, keys, limit = 8) {
  const counts = new Map();
  for (const key of keys) {
    for (const food of foodsOfDay(days[key])) {
      counts.set(food, (counts.get(food) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= MIN_FOOD_DAYS)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .slice(0, limit)
    .map(([food, dayCount]) => ({ food, days: dayCount }));
}

/** 一度でも書いた食べもの（入力を楽にするための候補。よく書いた順） */
export function foodSuggestions(days, limit = 12) {
  const counts = new Map();
  for (const key of Object.keys(days)) {
    for (const food of foodsOfDay(days[key])) {
      counts.set(food, (counts.get(food) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .slice(0, limit)
    .map(([food]) => food);
}

/** グラフ用に、期間ぶんを並べたもの（記録の無い日は null のまま残す＝間を詰めない） */
export function series(days, keys) {
  return keys.map((key) => {
    const day = days[key];
    const belly = day && day.belly ? BELLY_BY_ID[day.belly] : null;
    return {
      key,
      bellyOrder: belly ? belly.order : null,
      bellyLabel: belly ? belly.label : null,
      stools: day ? day.stools.filter((s) => s.bristol).map((s) => s.bristol) : [],
      recorded: hasRecord(day),
    };
  });
}

/**
 * ストレスと「体を動かしたか」の日数。
 * **点数にしない・平均を出さない**（お腹の段と同じ扱い）。数えるのは段ごとの日数だけ。
 */
export function lifeCounts(days, keys) {
  const stress = Object.fromEntries(LEVELS.map((l) => [l.id, 0]));
  const exercise = Object.fromEntries(EXERCISE_STEPS.map((e) => [e.id, 0]));
  const sleep = Object.fromEntries(SLEEP_STEPS.map((e) => [e.id, 0]));
  const posture = Object.fromEntries(POSTURE_STEPS.map((e) => [e.id, 0]));
  let stressDays = 0;
  let exerciseDays = 0;
  let sleepDays = 0;
  let postureDays = 0;
  for (const key of keys) {
    const day = days[key];
    if (!day) continue;
    if (day.stress && stress[day.stress] !== undefined) {
      stress[day.stress] += 1;
      stressDays += 1;
    }
    if (day.exercise && exercise[day.exercise] !== undefined) {
      exercise[day.exercise] += 1;
      exerciseDays += 1;
    }
    if (day.sleep && sleep[day.sleep] !== undefined) {
      sleep[day.sleep] += 1;
      sleepDays += 1;
    }
    if (day.posture && posture[day.posture] !== undefined) {
      posture[day.posture] += 1;
      postureDays += 1;
    }
  }
  return { stress, exercise, sleep, posture, stressDays, exerciseDays, sleepDays, postureDays };
}

/**
 * 市販薬を使った日を、種類ごとに数える。
 * **飲んだ量も、良し悪しも見ない**——受診のときに「使っているものがある」と伝えるための数え方。
 */
export function otcCounts(days, keys) {
  const byKind = {};
  let anyDays = 0;
  for (const key of keys) {
    const day = days[key];
    if (!day || !Array.isArray(day.otc) || day.otc.length === 0) continue;
    anyDays += 1;
    for (const id of day.otc) byKind[id] = (byKind[id] || 0) + 1;
  }
  return { byKind, anyDays };
}
