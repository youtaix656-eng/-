// 掲示板の棚卸し（新規）。**溜めるだけの掲示板にしない。**
//
// 掲示は30日で消える。それでいいものと、そうでないものがある：
//   何度も同じことが書かれている → それは「会社のルール」にすべき
//   消えると困る中身がある       → それは「知識」にすべき（出典が要る）
//
// AIを1回も呼ばない（文字の重なりを見るだけ）。
// **勝手に昇格させない**——提案するだけで、決めるのは人。

import { livePosts, BOARD_TTL_DAYS } from './board.js';

const DROP = /[はがのにをでとやもへか、。・「」『』（）()\s　]+/g;

function grams(text) {
  const s = String(text || '').toLowerCase().replace(DROP, '');
  const set = new Set();
  for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
  return set;
}

/** 2つの掲示がどれくらい重なっているか（0〜1）。 */
export function similarity(a, b) {
  const A = grams(a);
  const B = grams(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const g of A) if (B.has(g)) hit += 1;
  return hit / Math.min(A.size, B.size);
}

export const SAME_AT = 0.55; // これ以上似ていれば「同じことを言っている」
export const EXPIRE_SOON_DAYS = 5; // 消えるまでこれを切ったら知らせる
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 昇格の候補。
 * @returns {{kind:'rule'|'knowledge', text:string, count:number, why:string, postIds:string[]}[]}
 */
export function buildPromotions(board = [], { now = Date.now(), limit = 5 } = {}) {
  const posts = livePosts(board, now);
  const out = [];
  const used = new Set();

  // ① 何度も同じことが書かれている → 会社のルールの候補
  for (const p of posts) {
    if (used.has(p.id)) continue;
    const same = posts.filter((q) => q.id !== p.id && !used.has(q.id) && similarity(p.text, q.text) >= SAME_AT);
    if (!same.length) continue;
    for (const q of same) used.add(q.id);
    used.add(p.id);
    out.push({
      kind: 'rule',
      text: p.text,
      count: same.length + 1,
      why: `同じことが${same.length + 1}回書かれています。毎回書くより、会社のルールにした方が確実です。`,
      postIds: [p.id, ...same.map((q) => q.id)],
    });
  }

  // ② もうすぐ消えるのに、中身のある掲示 → 知識の候補
  const soon = now - (BOARD_TTL_DAYS - EXPIRE_SOON_DAYS) * DAY_MS;
  for (const p of posts) {
    if (used.has(p.id)) continue;
    if ((p.at || 0) > soon) continue; // まだ新しい
    if (p.text.length < 24) continue; // 短いものは残す価値が薄い
    out.push({
      kind: 'knowledge',
      text: p.text,
      count: 1,
      why: `あと${Math.max(1, Math.ceil((p.at + BOARD_TTL_DAYS * DAY_MS - now) / DAY_MS))}日で消えます。残すなら知識にしてください（出典が要ります）。`,
      postIds: [p.id],
    });
    used.add(p.id);
  }

  return out.sort((a, b) => b.count - a.count).slice(0, limit);
}

/** つまずきから、会社のルールの文案を作る（AIを呼ばない・そのまま出さず人が直す前提）。 */
export function ruleDraft(text) {
  const t = String(text || '').trim().replace(/[。.]$/, '');
  if (!t) return '';
  return t.length > 100 ? `${t.slice(0, 100)}…` : t;
}
