// 時計画面のアラーム（2026-11-15追加・ユーザー指定）。判定は純関数にしてあり、時計を読まない
// （nowは呼ぶ側が渡す＝node:testで固定できる）。鳴らす処理・保存はApp.jsx／Clock.jsx側。
//
// このアラームは「アプリを開いている／バックグラウンドにある」間だけ動く（サーバーも
// 端末のアラーム機能も使わない。JSのタイマーが動いている間しか判定できないため）。
// アプリを閉じている間は鳴らない——画面にもそう明記する（できないことをできるふりに書かない）。
//
// アラーム1件の形：
//   { id, time:'HH:MM', days:[0..6]（0=日。空なら1回だけ）, label, sound, enabled,
//     updatedAt（作成・編集・ONにした時刻。これより前の予定時刻では鳴らさない）,
//     lastFired（最後に鳴らした「日付 時刻」の印。同じ回を2度鳴らさない）,
//     snoozeUntil（スヌーズ中なら次に鳴らす時刻ms） }

export const ALARM_MAX = 20;
export const ALARM_GRACE_MS = 10 * 60 * 1000; // 予定時刻を過ぎても、この間に気づけたら鳴らす
export const SNOOZE_MIN = 5;
export const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dayKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseTime(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, min };
}

export function normalizeDays(days) {
  if (!Array.isArray(days)) return [];
  return Array.from(new Set(days.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))).sort((a, b) => a - b);
}

export function makeAlarm({ id, time, days, label, sound, enabled = true } = {}, now = Date.now()) {
  const t = parseTime(time);
  if (!t) return null;
  return {
    id: id || `al-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    time: `${pad2(t.h)}:${pad2(t.min)}`,
    days: normalizeDays(days),
    label: String(label || '').slice(0, 30),
    sound: sound || 'bell',
    enabled: !!enabled,
    updatedAt: now,
    lastFired: null,
    snoozeUntil: null,
  };
}

// いま鳴らすべき「予定の回」の印（「日付 時刻」）。無ければnull。
// 今日ぶんだけでなく昨日ぶんも見る（23:55のアラームを、裏で遅れて0:02に拾えるように）。
function dueOccurrenceKey(alarm, now) {
  const t = parseTime(alarm.time);
  if (!t) return null;
  const days = normalizeDays(alarm.days);
  const base = new Date(now);
  for (const back of [0, 1]) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - back, t.h, t.min, 0, 0);
    if (days.length > 0 && !days.includes(d.getDay())) continue;
    const at = d.getTime();
    if (now < at || now >= at + ALARM_GRACE_MS) continue;
    // 作成・編集した時点ですでに過ぎていた予定時刻では鳴らさない（07:05に07:00を作っても即鳴らさない）
    if ((alarm.updatedAt || 0) > at) continue;
    const key = `${dayKey(d)} ${alarm.time}`;
    if (alarm.lastFired === key) continue;
    return key;
  }
  return null;
}

// いま鳴らすべきか。
export function isAlarmDue(alarm, now = Date.now()) {
  if (!alarm || !alarm.enabled) return false;
  // スヌーズ中はスヌーズの時刻だけを見る。ただし拾えないまま過ぎたスヌーズ（アプリを閉じていた等）は
  // 捨てて、ふつうの予定に戻す（残したままだと、そのアラームが二度と鳴らなくなる）。
  if (alarm.snoozeUntil && now < alarm.snoozeUntil + ALARM_GRACE_MS) return now >= alarm.snoozeUntil;
  return dueOccurrenceKey(alarm, now) != null;
}

export function dueAlarms(alarms, now = Date.now()) {
  return (Array.isArray(alarms) ? alarms : []).filter((a) => isAlarmDue(a, now));
}

// 鳴らした印を付ける。くり返しの無いアラームは1回鳴らしたらオフにする。
export function markFired(alarm, now = Date.now()) {
  const repeating = normalizeDays(alarm.days).length > 0;
  // スヌーズから鳴った時は、元の回の印（lastFired）をそのまま残す（日付をまたいだスヌーズで
  // 印が書き換わり、同じ回がもう一度鳴るのを防ぐ）。
  const fromSnooze = !!alarm.snoozeUntil && now >= alarm.snoozeUntil && now < alarm.snoozeUntil + ALARM_GRACE_MS;
  const key = fromSnooze && alarm.lastFired
    ? alarm.lastFired
    : dueOccurrenceKey(alarm, now) || `${dayKey(new Date(now))} ${alarm.time}`;
  return {
    ...alarm,
    lastFired: key,
    snoozeUntil: null,
    enabled: repeating ? alarm.enabled : false,
  };
}

// スヌーズ：鳴っているアラームを止め、min分後にもう一度鳴らす（くり返し無しでも有効のまま）。
export function snoozeAlarm(alarm, now = Date.now(), min = SNOOZE_MIN) {
  return { ...alarm, enabled: true, snoozeUntil: now + min * 60 * 1000 };
}

// 次に鳴る時刻（ms）。オフ・時刻不正ならnull。
export function nextRingAt(alarm, now = Date.now()) {
  if (!alarm || !alarm.enabled) return null;
  if (alarm.snoozeUntil && alarm.snoozeUntil > now) return alarm.snoozeUntil;
  const t = parseTime(alarm.time);
  if (!t) return null;
  const days = normalizeDays(alarm.days);
  const base = new Date(now);
  for (let i = 0; i < 8; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, t.h, t.min, 0, 0);
    if (d.getTime() <= now) continue;
    if (days.length === 0 || days.includes(d.getDay())) return d.getTime();
  }
  return null;
}

// 「あと◯時間◯分」
export function untilText(ms) {
  if (ms == null || ms < 0) return '';
  const totalMin = Math.ceil(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}日`);
  if (h > 0) parts.push(`${h}時間`);
  if (m > 0 || parts.length === 0) parts.push(`${m}分`);
  return `あと${parts.join('')}`;
}

export function repeatText(days) {
  const ds = normalizeDays(days);
  if (ds.length === 0) return '1回だけ';
  if (ds.length === 7) return '毎日';
  if (ds.join(',') === '1,2,3,4,5') return '平日';
  if (ds.join(',') === '0,6') return '土日';
  return ds.map((d) => WEEKDAY_LABELS[d]).join('・');
}

export function sortAlarms(alarms) {
  return [...(Array.isArray(alarms) ? alarms : [])].sort((a, b) => String(a.time).localeCompare(String(b.time)));
}
