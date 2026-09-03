// いつもと違う期間に印をつける（提案6）。
//
// 決めていること
//  - **印をつけるだけ。** 期間の中で症状がどうだったかを、アプリが判定しない（決まり1・3）。
//  - **位置情報で自動判定しない**（決まり6）。始まりと終わりは人が入れる。
//  - **周期を予測しない。** 生理・月経を選べるようにしてあるが、次がいつ来るかは出さない
//    （予測は当たらないうえ、外れたときに不安にさせる）。
//  - 消せる・直せる（作った記録は必ず消せるようにする）。

import { parseKey, todayKey, diffDays } from './dates.js';
import { newId } from './days.js';

/** 印の種類。**ここが単一の正**（画面に文字列を直書きしない） */
export const PERIOD_KINDS = [
  { id: 'travel', label: '旅行・出張', reading: 'りょこうしゅっちょう' },
  { id: 'meals', label: 'いつもと違う食事', reading: 'いつもとちがうしょくじ' },
  { id: 'medicine', label: '薬が変わった', reading: 'くすりがかわった' },
  { id: 'period', label: '生理・月経', reading: 'せいりげっけい' },
  { id: 'sick', label: '体調をくずした', reading: 'たいちょうをくずした' },
  { id: 'other', label: 'その他', reading: 'そのた' },
];

export const KIND_BY_ID = Object.fromEntries(PERIOD_KINDS.map((k) => [k.id, k]));

const NOTE_MAX = 200;

export function normalizePeriod(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!parseKey(raw.from)) return null;
  if (!KIND_BY_ID[raw.kind]) return null;
  const to = parseKey(raw.to) ? raw.to : '';
  // 終わりが始まりより前なら、終わりを空にする（黙って入れ替えない）
  const okTo = to && diffDays(raw.from, to) >= 0 ? to : '';
  const note = typeof raw.note === 'string' ? raw.note.slice(0, NOTE_MAX) : '';
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('p'),
    kind: raw.kind,
    from: raw.from,
    to: okTo,
    note,
  };
}

export function normalizePeriods(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePeriod).filter(Boolean).sort((a, b) => (a.from < b.from ? -1 : 1));
}

/** その日が入っている印（複数ありうる。重ねてよい） */
export function periodsOn(periods, key) {
  return (periods || []).filter((p) => {
    if (key < p.from) return false;
    if (p.to && key > p.to) return false;
    return true;
  });
}

/** まだ終わっていない印（終わりが空） */
export function openPeriods(periods) {
  return (periods || []).filter((p) => !p.to);
}

/** 期間の日数（終わっていなければ今日まで） */
export function periodLength(period, today = todayKey()) {
  const end = period.to || today;
  return Math.max(1, diffDays(period.from, end) + 1);
}

export const PERIOD_NOTE =
  'いつもと違う期間に印をつけておくと、あとで見返したときに「この週だけ違う」の理由が分かります。'
  + 'アプリはこの印から症状の理由を決めません。次がいつ来るかも出しません。';
