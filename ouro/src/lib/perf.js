// 体感速度の記録（項目30）。
//
// 今日の数字は手で測ったもの。次に遅くなった時に気づけるよう、
// 起動・画面切り替え・保存にかかった時間を端末内に残す。
// **外へは一切送らない**（storage.js と同じく、ここもネットワークに触れない）。

const MAX = 60; // 直近60件だけ持つ

const marks = new Map();
let log = [];
let listeners = [];

export function mark(name) {
  marks.set(name, now());
}

/**
 * mark からの経過を記録する。
 * @param {object} [note] 新項目28：その時の状況（件数など）。
 *   数字だけ残しても「なぜ遅かったか」が分からないので、
 *   何件のデータを相手にしていたかを一緒に残す。
 * @returns 経過ms
 */
export function measure(name, category = 'other', note = null) {
  const from = marks.get(name);
  if (from == null) return null;
  marks.delete(name);
  return record(name, now() - from, category, note);
}

export function record(name, ms, category = 'other', note = null) {
  const entry = { name, ms: Math.round(ms), category, at: Date.now(), note: note || null };
  log = [...log, entry].slice(-MAX);
  for (const fn of listeners) fn(entry);
  return entry.ms;
}

/** 関数を包んで、かかった時間を記録する。 */
export function timed(name, category, fn) {
  const t = now();
  const out = fn();
  if (out && typeof out.then === 'function') {
    return out.finally(() => record(name, now() - t, category));
  }
  record(name, now() - t, category);
  return out;
}

export function entries() {
  return log;
}

export function clear() {
  log = [];
}

export function subscribe(fn) {
  listeners = [...listeners, fn];
  return () => {
    listeners = listeners.filter((x) => x !== fn);
  };
}

/** 種類ごとの中央値・最悪値（会社画面に出す）。 */
export function summary() {
  const byCat = new Map();
  for (const e of log) {
    if (!byCat.has(e.category)) byCat.set(e.category, []);
    byCat.get(e.category).push(e.ms);
  }
  return [...byCat.entries()]
    .map(([category, list]) => {
      const sorted = [...list].sort((a, b) => a - b);
      const worst = sorted[sorted.length - 1];
      // 新項目28：いちばん遅かった時の状況も一緒に返す。
      // 「画面の切り替え 最悪84ms」だけでは直しようがないが、
      // 「知識1200件の一覧で84ms」なら、どこを直せばよいか分かる。
      const worstEntry = log
        .filter((e) => e.category === category)
        .reduce((a, b) => (b.ms > (a ? a.ms : -1) ? b : a), null);
      return {
        category,
        count: sorted.length,
        median: sorted[Math.floor(sorted.length / 2)],
        worst,
        worstName: worstEntry ? worstEntry.name : '',
        worstNote: worstEntry ? worstEntry.note : null,
      };
    })
    .sort((a, b) => b.worst - a.worst);
}

export const CATEGORY_LABEL = {
  boot: '起動',
  view: '画面の切り替え',
  save: '保存',
  run: 'AIの実行',
  other: 'その他',
};

function now() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

// 新項目30：計測スクリプト（scripts/perf.mjs）から、会社画面と同じ集計を読めるようにする。
// 記録は端末の中にしかなく、ここでも外へは送らない。
if (typeof window !== 'undefined') {
  window.__ouroPerf = () => summary();
}
