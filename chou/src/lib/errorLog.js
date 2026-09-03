// 端末内のエラーログ（追加依頼8）。
//
// 決めていること
//  - **外へ送らない。** 記録するのも消すのもこの端末の中だけ（README 決まり7）。
//    送る仕組みを持たないことは `test/offline.test.mjs` が機械チェックしている。
//  - **記録の中身を混ぜない。** 残すのは「いつ・どこで・どんなエラーだったか」までで、
//    お腹の記録や食べたものは入れない（エラーの文に混ざりうるので `MAX_LEN` で切る）。
//  - **溜め続けない**（`MAX_ITEMS`）。古いものから落とす。
//  - **人を責めない。** 「操作を誤りました」とは書かない——落ちたのはアプリの側。
//  - 消せる（作った記録は必ず消せるようにする）。

import { newId } from './days.js';

export const MAX_ITEMS = 20;
const MAX_LEN = 400;

const clamp = (s) => String(s === null || s === undefined ? '' : s).slice(0, MAX_LEN);

export function makeEntry({ where = '', message = '', detail = '', at = Date.now() } = {}) {
  const body = clamp(message).trim();
  if (!body) return null;
  return {
    id: newId('e'),
    at,
    where: clamp(where),
    message: body,
    detail: clamp(detail),
  };
}

/** 新しいものが先頭。**古いものから落とす** */
export function addEntry(list, entry) {
  if (!entry) return Array.isArray(list) ? list : [];
  const base = Array.isArray(list) ? list : [];
  return [entry, ...base].slice(0, MAX_ITEMS);
}

export function normalizeErrors(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === 'object' && typeof e.message === 'string' && e.message)
    .map((e) => ({
      id: typeof e.id === 'string' && e.id ? e.id : newId('e'),
      at: Number.isFinite(e.at) ? e.at : 0,
      where: clamp(e.where),
      message: clamp(e.message),
      detail: clamp(e.detail),
    }))
    .slice(0, MAX_ITEMS);
}

/** 画面に出す時刻（**`toISOString()` を使わない**。決まり7） */
export function formatAt(at) {
  if (!Number.isFinite(at) || at <= 0) return '';
  const d = new Date(at);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 相談するときに貼れる形。**記録の中身は入らない** */
export function toText(list) {
  const items = Array.isArray(list) ? list : [];
  if (items.length === 0) return 'エラーの記録はありません。';
  return items
    .map((e) => [formatAt(e.at), e.where ? `（${e.where}）` : '', e.message, e.detail].filter(Boolean).join(' '))
    .join('\n');
}

export const ERROR_LOG_NOTE =
  'アプリの中で起きたエラーを、この端末にだけ残しています。どこへも送りません。'
  + '不具合が出たときの手がかりに使えます。中身を見て、消すこともできます。';

export const ERROR_LOG_EMPTY = 'いまのところ、記録されているエラーはありません。';
