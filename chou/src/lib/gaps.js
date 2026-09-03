// 記録が抜けている日を見つける（提案2）。
//
// 決めていること
//  - **責める言い方をしない**（README 決まり5）。出すのは「まだ空いている日」までで、
//    「サボった日」「連続が途切れた」とは言わない。連続日数も数えない。
//  - **さかのぼって埋めるのは自由**。あとから思い出して書くほうが、空欄のまま残るより良い。
//  - 未来の日は出さない（まだ来ていない日は「抜けている」ではない）。

import { lastKeys, todayKey } from './dates.js';
import { hasRecord } from './days.js';

/** 直近 n 日のうち、まだ何も書いていない日（新しい順） */
export function missingDays(days, n = 14, today = todayKey()) {
  const keys = lastKeys(n, today);
  return keys.filter((k) => !hasRecord((days || {})[k])).reverse();
}

/** 直近 n 日のうち、記録した日の数 */
export function filledCount(days, n = 14, today = todayKey()) {
  const keys = lastKeys(n, today);
  return keys.filter((k) => hasRecord((days || {})[k])).length;
}

/**
 * 画面に出す一言。**「◯日続けています」を出さない**——
 * 途切れた日が「怠けた日」に見える作りにしない（決まり5）。
 */
export function gapLine(missing, n = 14) {
  if (missing.length === 0) return `この${n}日は、ぜんぶ何か書けています。`;
  if (missing.length >= n) return `この${n}日は、まだ何も書いていません。1日ぶんからで大丈夫です。`;
  return `この${n}日のうち、${missing.length}日が空いています。思い出せるぶんだけ埋められます。`;
}

export const GAP_NOTE =
  'あとから書いても構いません。空いている日があること自体は、良し悪しではありません。'
  + '体調が悪い日ほど書けないものなので、埋まっていない日が続いていても気にしないでください。';
