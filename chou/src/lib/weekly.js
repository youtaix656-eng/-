// 週次のふりかえり（提案10・追加依頼6）。
//
// 決めていること
//  - **並べるだけ。** 今週と先週を横に置くところまでで、
//    「良くなった／悪くなった」とは書かない（README 決まり3）。
//  - **平均を出さない**（決まり2）。数えるのは日数と件数だけ。
//  - **連続日数を煽らない**（決まり5）。出すのは「書けた日数」で、途切れを数えない。
//  - **印が付いた日数は数えるが、順位も判定も付けない**（決まり1）。
//    印はあくまで「受診のときに伝えること」で、危険度ではない。

import { hasRecord, flagMarksOf } from './days.js';
import { lastKeys, shiftKey, rangeKeys, todayKey, formatShort } from './dates.js';
import { isHardDay } from './compare.js';

/** 週の長さ（曜日で切らない——始めた曜日で結果が変わらないようにするため） */
export const WEEK = 7;

function countWeek(days, keys) {
  let recorded = 0;
  let flagged = 0;
  let stools = 0;
  let hard = 0;
  for (const key of keys) {
    const day = (days || {})[key];
    if (!day) continue;
    if (hasRecord(day)) recorded += 1;
    if (flagMarksOf(day).length > 0) flagged += 1;
    stools += day.stools.length;
    if (isHardDay(day)) hard += 1;
  }
  return { recorded, flagged, stools, hard, total: keys.length };
}

/** 今週（直近7日）と先週（その前の7日）を並べる */
export function weeklyReview(days, today = todayKey()) {
  const thisKeys = lastKeys(WEEK, today);
  const prevEnd = shiftKey(thisKeys[0], -1);
  const prevStart = shiftKey(prevEnd, -(WEEK - 1));
  const prevKeys = rangeKeys(prevStart, prevEnd);
  return {
    thisWeek: { range: [thisKeys[0], thisKeys[thisKeys.length - 1]], ...countWeek(days, thisKeys) },
    lastWeek: { range: [prevStart, prevEnd], ...countWeek(days, prevKeys) },
  };
}

export function rangeLabel(range) {
  if (!range || range.length !== 2) return '';
  return `${formatShort(range[0])}〜${formatShort(range[1])}`;
}

/** 並べる行。**差を「増えた・減った」までで止める**（良し悪しを書かない） */
export function weeklyRows(review) {
  return [
    { id: 'recorded', label: '書けた日', now: review.thisWeek.recorded, before: review.lastWeek.recorded, unit: '日' },
    { id: 'flagged', label: '気になった印が付いた日', now: review.thisWeek.flagged, before: review.lastWeek.flagged, unit: '日' },
    { id: 'hard', label: 'つらいほうの段だった日', now: review.thisWeek.hard, before: review.lastWeek.hard, unit: '日' },
    { id: 'stools', label: 'お通じの回数', now: review.thisWeek.stools, before: review.lastWeek.stools, unit: '回' },
  ];
}

/** 差の言い方。**「良くなった」「悪くなった」を返さない** */
export function diffLine(row) {
  const d = row.now - row.before;
  if (d === 0) return '同じ';
  return d > 0 ? `${d}${row.unit}多い` : `${-d}${row.unit}少ない`;
}

export const WEEKLY_NOTE =
  '2つの週を横に並べているだけです。増えた・減ったは、良くなった・悪くなったという意味ではありません。'
  + '書けた日数が違えば、ほかの数も違って見えます。';

export const WEEKLY_FLAG_NOTE =
  '「気になった印」は、受診のときに伝えるためのものです。数が多いか少ないかで、'
  + 'このアプリが何かを決めることはありません。付いた日があるなら、受診の目安を読んでください。';
