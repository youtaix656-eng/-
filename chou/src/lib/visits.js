// 受診まわり（提案14〜16）。通院の予定・聞きたいこと・受診のあとに言われたこと。
//
// 決めていること
//  - **通知を作らない**（README 決まり6）。サーバーを持たないので「前日に知らせる」を
//    約束できない。出すのは「あと◯日」という表示までで、鳴らさない。
//  - **診断名を持たせない。** 言われたことは**本人が書いた言葉のまま**残す
//    （アプリが病名に整えると、書いていないことまで書いたことになる）。
//  - **聞きたいことを採点しない・並べ替えない**（書いた順のまま）。
//  - 作った記録は必ず消せる。

import { parseKey, todayKey, diffDays } from './dates.js';
import { newId } from './days.js';

const TEXT_MAX = 400;
const LONG_MAX = 2000;

const clamp = (s, max) => (typeof s === 'string' ? s.slice(0, max) : '');

function normalizeQuestion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = clamp(raw.text, TEXT_MAX).trim();
  if (!text) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('q'),
    text,
    asked: raw.asked === true,
  };
}

export function normalizeVisit(raw) {
  if (!raw || typeof raw !== 'object' || !parseKey(raw.on)) return null;
  const after = raw.after && typeof raw.after === 'object' ? raw.after : {};
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('v'),
    on: raw.on,
    place: clamp(raw.place, TEXT_MAX).trim(),
    purpose: clamp(raw.purpose, TEXT_MAX).trim(),
    questions: (Array.isArray(raw.questions) ? raw.questions : []).map(normalizeQuestion).filter(Boolean),
    after: {
      done: after.done === true,
      said: clamp(after.said, LONG_MAX),
      meds: clamp(after.meds, LONG_MAX),
      nextOn: parseKey(after.nextOn) ? after.nextOn : '',
      note: clamp(after.note, LONG_MAX),
    },
  };
}

export function normalizeVisits(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeVisit).filter(Boolean).sort((a, b) => (a.on < b.on ? -1 : 1));
}

/** これから（今日を含む） */
export function upcomingVisits(visits, today = todayKey()) {
  return (visits || []).filter((v) => v.on >= today);
}

/** 済んだもの（新しい順） */
export function pastVisits(visits, today = todayKey()) {
  return (visits || []).filter((v) => v.on < today).slice().reverse();
}

/** いちばん近い予定 */
export function nextVisit(visits, today = todayKey()) {
  const list = upcomingVisits(visits, today);
  return list.length > 0 ? list[0] : null;
}

/** あと何日か。**鳴らさない・急かさない**——表示するだけ */
export function daysUntil(visit, today = todayKey()) {
  if (!visit) return null;
  return diffDays(today, visit.on);
}

export function visitLine(visit, today = todayKey()) {
  if (!visit) return '通院の予定は入れていません。';
  const n = daysUntil(visit, today);
  if (n === 0) return 'きょうが通院の日です。';
  if (n === 1) return 'あしたが通院の日です。';
  return `つぎの通院まで、あと${n}日です。`;
}

/** まだ聞けていないこと（受診の日に出す） */
export function openQuestions(visit) {
  if (!visit) return [];
  return visit.questions.filter((q) => !q.asked);
}

/**
 * 前回の受診で言われたことを、次の受診メモへ引き継ぐ文。
 * **アプリが要約しない**——本人が書いた言葉をそのまま並べる。
 */
export function carryOverText(visit) {
  if (!visit || !visit.after || !visit.after.done) return '';
  const lines = [];
  lines.push(`前回（${visit.on}${visit.place ? `・${visit.place}` : ''}）で言われたこと`);
  if (visit.after.said) lines.push(visit.after.said);
  if (visit.after.meds) lines.push(`出された薬：${visit.after.meds}`);
  if (visit.after.note) lines.push(visit.after.note);
  return lines.join('\n');
}

export const NO_REMINDER_NOTE =
  'このアプリは通知を鳴らしません。サーバーを持っていないので「前日に知らせる」を約束できないからです。'
  + '大事な予定は、端末のカレンダーにも入れておいてください。';

export const VISIT_NOTE =
  '聞きたいことは、受診のときに必ず忘れます。思いついたときにここへ足しておくと、'
  + '受診メモに一緒に出せます。順番も数も、こちらでは変えません。';

export const AFTER_NOTE =
  '言われたことは、書いた言葉のまま残します。アプリが病名に整えることはしません。'
  + '次の受診メモの先頭に、そのまま引き継げます。';
