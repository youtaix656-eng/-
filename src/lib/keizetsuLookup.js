// 経絡経穴概論 索引（keizetsuIndex.js）の各項目を、アプリ内の既存データ
// （keiketsuCards.js の経穴カード、knowledgeBase.js の要穴・経絡・奇経八脈・
// 紛らわしい経穴）と突き合わせる。索引はあくまで教科書のページ番号一覧なので、
// ここでの解決結果に応じて「どこまで詳しく出せるか」を画面側が出し分ける
// （読めない・持っていないデータを持っているふりをしないため）。

import { KEIKETSU_CARDS } from '../data/keiketsuCards.js';
import {
  buildPointIndex,
  meridians,
  extraMeridianPoints,
  confusablePoints,
  meridianNameById,
} from '../data/knowledgeBase.js';

const POINT_INDEX = buildPointIndex();

const MERIDIAN_BY_NAME = new Map();
meridians.forEach((m) => {
  MERIDIAN_BY_NAME.set(m.name, m);
  MERIDIAN_BY_NAME.set(m.short, m);
});
MERIDIAN_BY_NAME.set('任脈', { id: 'CV', name: '任脈', short: '任脈', organ: null, yinYang: null, element: null });
MERIDIAN_BY_NAME.set('督脈', { id: 'GV', name: '督脈', short: '督脈', organ: null, yinYang: null, element: null });

// 索引の見出し語には教科書表記のゆれ（別名の併記など）が括弧で入っている場合がある
// （例:「犢鼻（外膝眼）」「帯脈（奇経八脈）」）。突き合わせは主表記（括弧の前）で行う。
export function bareKeizetsuTerm(term) {
  return String(term || '').replace(/[（(][^）)]*[）)]/g, '').trim();
}

function findConfusable(bare) {
  return confusablePoints.find((c) => c.a === bare || c.b === bare) || null;
}

// 索引1項目 → 解決結果。
// kind: 'card'（フラッシュカード有り・最も詳しい）/ 'point'（要穴として経絡に属する）/
//       'meridian'（経絡そのもの）/ 'extra'（奇経八脈の所属穴）/
//       'confusable'（紛らわしい経穴の対）/ 'none'（アプリ未収録・ページ番号のみ）
export function resolveKeizetsuTerm(term) {
  const bare = bareKeizetsuTerm(term);

  const card = KEIKETSU_CARDS.find((c) => c.name === bare);
  if (card) {
    return { kind: 'card', term: bare, card, confusable: findConfusable(bare) };
  }

  const roles = POINT_INDEX[bare];
  if (roles && roles.length > 0) {
    return {
      kind: 'point',
      term: bare,
      roles: roles.map((r) => ({ ...r, meridianName: meridianNameById(r.meridian) })),
      confusable: findConfusable(bare),
    };
  }

  const meridian = MERIDIAN_BY_NAME.get(bare);
  if (meridian) {
    return { kind: 'meridian', term: bare, meridian };
  }

  const extra = extraMeridianPoints.find((e) => e.name === bare);
  if (extra) {
    return { kind: 'extra', term: bare, extra };
  }

  const confusable = findConfusable(bare);
  if (confusable) {
    return { kind: 'confusable', term: bare, confusable };
  }

  return { kind: 'none', term: bare };
}

// 索引データは教科書のレイアウト上、同じ用語が複数回転記されている場合がある
// （五十音の行またぎ等）。表示用に用語単位でまとめ、ページ番号は和集合にする。
export function dedupeKeizetsuIndex(list) {
  const map = new Map();
  for (const e of list) {
    if (!map.has(e.term)) {
      map.set(e.term, { term: e.term, reading: e.reading, pages: [...e.pages] });
    } else {
      const existing = map.get(e.term);
      for (const p of e.pages) if (!existing.pages.includes(p)) existing.pages.push(p);
    }
  }
  return [...map.values()];
}
