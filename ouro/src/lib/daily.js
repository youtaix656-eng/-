// 今日やる1つ。
//
// 事業を立ち上げる時にいちばん効くのは、賢い計画ではなく
// **「今日これをやる」が朝に1つ決まっていること**。
//
// 決まりごと：
//  ・**カレンダーに複製しない。**（締切と同じで、毎回ここから導く。
//    予定として書き写すと、事業を直してもカレンダーが古いままになる）
//  ・**連続日数を煽らない。**（変革ノートと同じ。主役は「◯日目/全◯日」と
//    通算の実践日数。途切れた瞬間にやめる理由を作らせない）
//  ・AIを呼ばない。

import { dayIndex, daysLeft } from './venture.js';
import { postsOn } from './posts.js';

const DAY = 86400000;

/** 3つの枠。**数と順番を増やさない**（増やすと「今日やる1つ」でなくなる）。 */
export const SLOTS = [
  {
    id: 'share',
    name: '出す',
    glyph: '↗',
    label: '今日のぶんを1本出す',
    why: '作っただけでは誰にも届きません。数より、出し続けること。',
    view: 'ventures',
  },
  {
    id: 'build',
    name: '作る',
    glyph: '✎',
    label: 'この事業の仕事を1つ進める',
    why: 'AI社員に投げるのはここ。1日1つで十分です。',
    view: 'compose',
  },
  {
    id: 'count',
    name: '数える',
    glyph: '▤',
    label: '出したものの反応を書く',
    why: '数えていない数字は判断に使えません。0でも書きます。',
    view: 'ventures',
  },
];

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * 今日の3つと、次にやる1つ。
 *
 * @param {object} o
 * @param {object} o.venture   実行中の事業
 * @param {object[]} o.posts   発信ログ（この事業ぶん）
 * @param {object[]} o.tasks   仕事（この事業ぶん）
 * @param {boolean} o.loaded   発信ログの読み込みが済んでいるか。
 *   **済むまで「未」と言い切らない**（起動直後は空配列なので、
 *   やったことを「やっていない」と表示してしまう）。
 */
export function todayPlan({ venture = null, posts = [], tasks = [], loaded = true, now = Date.now() } = {}) {
  const today = startOfDay(now);
  const todayPosts = postsOn(posts, now);
  const touchedTask = tasks.some((t) => {
    const at = t.finishedAt || t.startedAt || t.createdAt || 0;
    return at >= today;
  });
  const counted = todayPosts.some((p) => p.reach > 0 || p.reaction > 0 || p.lead > 0);

  const doneOf = {
    share: todayPosts.length > 0,
    build: touchedTask,
    count: counted,
  };

  const items = SLOTS.map((s) => ({
    ...s,
    done: loaded ? doneOf[s.id] : false,
    unknown: !loaded,
  }));

  const next = items.find((i) => !i.done) || null;

  return {
    venture,
    items,
    next,
    loaded,
    day: dayIndex(venture, now),
    total: venture ? venture.days || 0 : 0,
    left: daysLeft(venture, now),
    // 通算の実践日数（連続ではない）。休んだ日があっても減らない。
    practiceDays: practiceDays(posts, tasks, now),
    doneCount: items.filter((i) => i.done).length,
  };
}

/**
 * 通算の実践日数。**連続日数ではない。**
 * 「発信した日」または「仕事を動かした日」を数える。
 */
export function practiceDays(posts = [], tasks = [], now = Date.now()) {
  const days = new Set();
  for (const p of posts) days.add(startOfDay(p.postedAt));
  for (const t of tasks) {
    const at = t.finishedAt || t.startedAt || t.createdAt || 0;
    if (at) days.add(startOfDay(at));
  }
  days.delete(0);
  // 未来の日付は数えない（時計がずれた端末で増えてしまうため）
  const limit = startOfDay(now) + DAY;
  return [...days].filter((d) => d < limit).length;
}

/** ホームに出す1行。**「◯日連続」とは書かない。** */
export function todayLine(plan) {
  if (!plan || !plan.venture) return '実行中の事業がありません。';
  if (!plan.loaded) return '確認中…';
  if (!plan.next) return `今日のぶんは終わりました（${plan.day}日目／全${plan.total}日）。`;
  return `${plan.next.glyph} ${plan.next.label}（${plan.day}日目／全${plan.total}日）`;
}
