// 認知特性の自己申告の集計。**診断をしない**ための決まりをここに集めている。
//
// 1. **同点なら決めない。** 差が小さいときは「決まりません」と返す。
//    無理に1つに寄せると、その入り口以外を試さなくなる。
// 2. **未回答があるときは断定しない。** 何問答えたかを必ず一緒に返し、画面はそれを出す。
// 3. **「あなたは◯◯型です」と言わない。** 返すのは「今日の答えでは◯◯が多めでした」。
// 4. 点は 0〜3 の合計を、その入り口の質問数で割った平均で見る（質問数が偏っても比べられる）。

import { COGNITIVE_QUESTIONS, CHANNELS, ORDERS } from '../data/cognitiveQuestions.js';

/** 1位と2位の差がこれ未満なら「決まりません」（0〜3の平均に対する差） */
export const TIE_MARGIN = 0.34;

/** 断定を始めてよい回答数の下限（その軸の質問の何割に答えたか） */
export const MIN_ANSWERED_RATIO = 0.6;

function questionsOf(axis) {
  return COGNITIVE_QUESTIONS.filter((q) => q.axis === axis);
}

/**
 * 1つの軸（channel / order）の集計。
 * @param {Object} answers { [questionId]: 0..3 }
 * @returns {{ scores: Object, top: string|null, reason: string, answered: number, total: number }}
 */
export function scoreAxis(answers = {}, axis = 'channel') {
  const questions = questionsOf(axis);
  const byKey = new Map();
  let answered = 0;
  for (const q of questions) {
    const raw = answers?.[q.id];
    const has = raw != null && raw !== '';
    if (has) answered += 1;
    const bucket = byKey.get(q.key) || { sum: 0, count: 0, answered: 0 };
    bucket.count += 1;
    if (has) {
      bucket.sum += Number(raw) || 0;
      bucket.answered += 1;
    }
    byKey.set(q.key, bucket);
  }

  const scores = {};
  for (const [key, b] of byKey) {
    // 答えた問だけで平均を出す（未回答を0点にすると「答えていない＝合わない」になってしまう）
    scores[key] = b.answered > 0 ? b.sum / b.answered : null;
  }

  const total = questions.length;
  if (answered / total < MIN_ANSWERED_RATIO) {
    return { scores, top: null, reason: 'not-enough', answered, total };
  }

  const ranked = Object.entries(scores)
    .filter(([, v]) => v != null)
    .sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return { scores, top: null, reason: 'not-enough', answered, total };
  if (ranked.length === 1) return { scores, top: ranked[0][0], reason: 'ok', answered, total };

  const gap = ranked[0][1] - ranked[1][1];
  if (gap < TIE_MARGIN) return { scores, top: null, reason: 'tie', answered, total };
  return { scores, top: ranked[0][0], reason: 'ok', answered, total };
}

/** 両方の軸をまとめて集計する */
export function profileOf(answers = {}) {
  const channel = scoreAxis(answers, 'channel');
  const order = scoreAxis(answers, 'order');
  return {
    channel,
    order,
    answered: channel.answered + order.answered,
    total: channel.total + order.total,
  };
}

/** 何も答えていないか（画面の「まだ答えていません」判定に使う） */
export function isUnanswered(answers = {}) {
  return COGNITIVE_QUESTIONS.every((q) => answers?.[q.id] == null || answers?.[q.id] === '');
}

/**
 * 結果の1行。**断定しない言い方**をここに集約する（画面ごとにブレないため）。
 * どの画面もこの関数の文を使うこと。
 */
export function profileLine(profile) {
  if (!profile) return '認知特性はまだ答えていません。';
  const parts = [];
  const ch = profile.channel;
  if (ch.reason === 'not-enough') parts.push('入り口はまだ判断できません（回答が足りません）');
  else if (ch.reason === 'tie') parts.push('入り口はどれか1つに決まりませんでした（複数を試すのが向いています）');
  else parts.push(`今日の答えでは「${CHANNELS[ch.top]?.label ?? ch.top}」が多めでした`);

  const or = profile.order;
  if (or.reason === 'not-enough') parts.push('進め方はまだ判断できません');
  else if (or.reason === 'tie') parts.push('進め方はどちらとも決まりませんでした');
  else parts.push(`進め方は「${ORDERS[or.top]?.label ?? or.top}」寄りでした`);

  return `${parts.join('。')}。（${profile.answered}/${profile.total}問に回答）`;
}

/** 提案に渡す値。決まっていなければ null（null を渡された側は相性で点を足さない） */
export function channelOf(profile) {
  return profile?.channel?.reason === 'ok' ? profile.channel.top : null;
}

export function orderOf(profile) {
  return profile?.order?.reason === 'ok' ? profile.order.top : null;
}
