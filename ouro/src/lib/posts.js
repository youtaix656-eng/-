// 発信ログ——何を・どこへ・いつ出したか。
//
// Ouro には「作る」を助ける仕組みばかりで、**出したものを数える場所が無かった。**
// 収益導線の「集める」に入れる数字は、ここが元になる。
//
// 端末内だけに残る。SNSのAPIには**つながない**（サーバーを持たない方針のまま、
// 数字は手で入れる。自動で取れないものを取れるふりはしない）。

import { newId } from './id.js';

export const POST_CHANNELS = [
  { id: 'x', name: 'X' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'note', name: 'note・ブログ' },
  { id: 'mail', name: 'メール・LINE' },
  { id: 'other', name: 'その他' },
];

/** 溜めすぎない。古いものから落とす（掲示板と違い、消える期限は持たない）。 */
export const MAX_POSTS = 500;

export function channelName(id) {
  return POST_CHANNELS.find((c) => c.id === id)?.name || 'その他';
}

export function makePost(data = {}) {
  const now = Date.now();
  return {
    id: data.id || newId('post'),
    ventureId: data.ventureId || null,
    channel: POST_CHANNELS.some((c) => c.id === data.channel) ? data.channel : 'other',
    title: String(data.title || '').slice(0, 100),
    url: String(data.url || '').slice(0, 300),
    // 出した本文（書き出しの重なりを見るのに使う）
    text: String(data.text || '').slice(0, 2000),
    postedAt: Number(data.postedAt) || now,
    // 反応。分からないものは 0 のままでよい（推測で埋めない）
    reach: num(data.reach),
    reaction: num(data.reaction),
    lead: num(data.lead),
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

export function addPost(posts = [], post) {
  if (!post || !post.id) return posts;
  return [post, ...posts.filter((p) => p.id !== post.id)]
    .sort((a, b) => b.postedAt - a.postedAt)
    .slice(0, MAX_POSTS);
}

export function updatePost(posts = [], id, patch = {}) {
  return posts.map((p) => (p.id === id ? { ...p, ...patch, id: p.id, updatedAt: Date.now() } : p));
}

export function removePost(posts = [], id) {
  return posts.filter((p) => p.id !== id);
}

/** 事業でしぼる。ventureId を渡さなければ全部。 */
export function postsOf(posts = [], ventureId = null) {
  if (!ventureId) return posts;
  return posts.filter((p) => p.ventureId === ventureId);
}

export function postsOn(posts = [], t = Date.now()) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const start = d.getTime();
  return posts.filter((p) => p.postedAt >= start && p.postedAt < start + 86400000);
}

/** 直近 days 日の合計。0件なら count だけ 0 で返す（平均を作らない）。 */
export function postStats(posts = [], days = 7, now = Date.now()) {
  const since = now - days * 86400000;
  const rows = posts.filter((p) => p.postedAt >= since);
  return {
    count: rows.length,
    reach: rows.reduce((s, p) => s + p.reach, 0),
    reaction: rows.reduce((s, p) => s + p.reaction, 0),
    lead: rows.reduce((s, p) => s + p.lead, 0),
    byChannel: POST_CHANNELS.map((c) => ({
      id: c.id,
      name: c.name,
      count: rows.filter((p) => p.channel === c.id).length,
    })).filter((c) => c.count > 0),
  };
}

/**
 * 収益導線の「その週の数字」の下書き。
 * **入れるのは人がボタンを押した時だけ**（勝手に上書きしない）。
 */
export function weekDraft(posts = [], weekStart) {
  const end = weekStart + 7 * 86400000;
  const rows = posts.filter((p) => p.postedAt >= weekStart && p.postedAt < end);
  return {
    reach: rows.reduce((s, p) => s + p.reach, 0),
    read: rows.reduce((s, p) => s + p.reaction, 0),
    lead: rows.reduce((s, p) => s + p.lead, 0),
    sale: 0, // 売れた数は案件の側で数えるので、ここでは埋めない
    count: rows.length,
  };
}
