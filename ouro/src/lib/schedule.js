// カレンダー（予定と実績）。
//
// 会社で起きたことを日付で見られるようにする。
//   実績：完了した仕事／増えた知識／開いた会議（tasks・knowledge・meetings から導く）
//   予定：案件の締切（deals の dueAt から導く）／自分で入れた予定（events）
//
// **案件の締切は events に複製しない。** deals から毎回導く
// （二重管理にすると、締切を直したのにカレンダーが古いままになる）。

// 予定1件の作り方は eventItem.js にある（起動時に読む量を増やさないための切り出し）。
// ここからも再輸出するので、カレンダー側の import は今までどおりでよい。
import { DAY_MS, EVENT_KINDS, startOfDay, makeEvent } from './eventItem.js';

export { DAY_MS, EVENT_KINDS, startOfDay, makeEvent };

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function sameDay(a, b) {
  return startOfDay(a) === startOfDay(b);
}

export function ymd(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 月のマス目。日曜始まりで、前後の月の日も埋めて必ず7の倍数にする
 * （行の途中で切れると曜日の列がずれるため）。
 */
export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  const days = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({
      ts: startOfDay(d.getTime()),
      date: d.getDate(),
      inMonth: d.getMonth() === month,
      weekday: d.getDay(),
    });
    // 6週目に入っていて、その週が全部翌月なら打ち切る
    if (i >= 34 && (i + 1) % 7 === 0) {
      const weekStart = days.length - 7;
      if (days.slice(weekStart).every((x) => !x.inMonth)) {
        days.length = weekStart;
        break;
      }
    }
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/**
 * 1日ぶんの中身。実績と予定をまとめて返す。
 * @returns {{ts, tasks, knowledge, meetings, deadlines, events, total}}
 */
export function dayDetail(ts, { tasks = [], knowledge = [], meetings = [], deals = [], events = [] } = {}) {
  const day = startOfDay(ts);
  const inDay = (t) => t && startOfDay(t) === day;

  const doneTasks = tasks.filter((t) => t.status === 'done' && inDay(t.finishedAt));
  const newKnowledge = knowledge.filter((k) => inDay(k.createdAt));
  const heldMeetings = meetings.filter((m) => inDay(m.createdAt));
  // 締切は deals から毎回導く（events に複製しない）
  const deadlines = deals.filter((d) => d.dueAt && inDay(d.dueAt) && !['paid', 'lost'].includes(d.status));
  const dayEvents = events.filter((e) => inDay(e.at));

  return {
    ts: day,
    tasks: doneTasks,
    knowledge: newKnowledge,
    meetings: heldMeetings,
    deadlines,
    events: dayEvents,
    total: doneTasks.length + newKnowledge.length + heldMeetings.length + deadlines.length + dayEvents.length,
  };
}

/**
 * 日付でひける索引を1回だけ作る（項目14）。
 *
 * 以前は 42マス × 全データ を毎回走査していたため、予定が増えるほど
 * 月送りが重くなっていた（実測 117ms）。データ側を1周して日付ごとに
 * 振り分けておけば、マスは引くだけで済む。
 */
export function buildDayIndex({ tasks = [], knowledge = [], meetings = [], deals = [], events = [] } = {}) {
  const index = new Map();
  const bucket = (ts) => {
    const day = startOfDay(ts);
    let b = index.get(day);
    if (!b) {
      b = { tasks: [], knowledge: [], meetings: [], deadlines: [], events: [] };
      index.set(day, b);
    }
    return b;
  };

  for (const t of tasks) if (t.status === 'done' && t.finishedAt) bucket(t.finishedAt).tasks.push(t);
  for (const k of knowledge) if (k.createdAt) bucket(k.createdAt).knowledge.push(k);
  for (const m of meetings) if (m.createdAt) bucket(m.createdAt).meetings.push(m);
  for (const d of deals) {
    if (d.dueAt && !['paid', 'lost'].includes(d.status)) bucket(d.dueAt).deadlines.push(d);
  }
  for (const e of events) if (e.at) bucket(e.at).events.push(e);
  return index;
}

const EMPTY_DAY = { tasks: [], knowledge: [], meetings: [], deadlines: [], events: [] };

/** 索引から1日ぶんを引く。 */
export function dayFromIndex(index, ts) {
  const day = startOfDay(ts);
  const b = index.get(day) || EMPTY_DAY;
  return {
    ts: day,
    ...b,
    total: b.tasks.length + b.knowledge.length + b.meetings.length + b.deadlines.length + b.events.length,
  };
}

/** 月のマスに出す小さな印。索引を渡せばマスを引くだけで済む。 */
export function monthMarks(weeks, dataOrIndex) {
  const index = dataOrIndex instanceof Map ? dataOrIndex : buildDayIndex(dataOrIndex);
  const marks = new Map();
  for (const week of weeks) {
    for (const cell of week) {
      const d = dayFromIndex(index, cell.ts);
      if (d.total > 0) {
        marks.set(cell.ts, {
          tasks: d.tasks.length,
          knowledge: d.knowledge.length,
          deadlines: d.deadlines.length,
          events: d.events.length,
          meetings: d.meetings.length,
        });
      }
    }
  }
  return marks;
}

/** その月の集計。 */
export function monthSummary(year, month, { tasks = [], knowledge = [], deals = [] } = {}) {
  const from = new Date(year, month, 1).getTime();
  const to = new Date(year, month + 1, 1).getTime();
  const within = (t) => t >= from && t < to;

  const done = tasks.filter((t) => t.status === 'done' && within(t.finishedAt || 0));
  return {
    tasks: done.length,
    knowledge: knowledge.filter((k) => within(k.createdAt)).length,
    cost: done.reduce((s, t) => s + (t.totalCost || 0), 0),
    earned: deals
      .filter((d) => d.status === 'paid' && within(d.paidAt || d.updatedAt || 0))
      .reduce((s, d) => s + (d.fee || 0), 0),
  };
}

/**
 * 締切から逆算した「いつ着手すべきか」。
 * 締切日にいきなり始めるのを避けるため、余裕があれば数日前を提案する。
 */
export function suggestStart(deal, now = Date.now()) {
  if (!deal || !deal.dueAt) return null;
  // 日数は「日付どうし」で数える（時刻が混ざると1日ずれる）
  const daysLeft = Math.round((startOfDay(deal.dueAt) - startOfDay(now)) / DAY_MS);
  if (daysLeft < 0) return { daysLeft, startAt: startOfDay(now), overdue: true, lead: 0 };
  // 締切までの日数に応じて、着手の目安を前倒しする
  const lead = daysLeft >= 14 ? 7 : daysLeft >= 7 ? 3 : daysLeft >= 3 ? 1 : 0;
  return {
    daysLeft,
    lead,
    startAt: startOfDay(deal.dueAt) - lead * DAY_MS,
    overdue: false,
  };
}

/** 直近の予定と締切をまとめて、近い順に返す（ホームの表示に使う）。 */
export function upcoming({ events = [], deals = [] }, now = Date.now(), days = 14) {
  const from = startOfDay(now);
  const to = from + days * DAY_MS;
  const out = [];

  for (const e of events) {
    if (e.at >= from && e.at < to && !e.done) {
      out.push({ at: e.at, kind: 'event', title: e.title, eventKind: e.kind, id: e.id });
    }
  }
  for (const d of deals) {
    if (d.dueAt && d.dueAt >= from && d.dueAt < to && !['paid', 'lost'].includes(d.status)) {
      out.push({ at: d.dueAt, kind: 'deadline', title: d.title, id: d.id, fee: d.fee });
    }
  }
  return out.sort((a, b) => a.at - b.at).map((x) => ({ ...x, daysLeft: Math.round((x.at - from) / DAY_MS) }));
}
