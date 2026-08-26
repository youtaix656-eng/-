// 社内掲示板（新規）。**社員どうしの共通記憶**。
//
// これまで社員が知れたのは4つだけだった：会社の知識／自分の記憶／
// 前の担当からの引き継ぎ／この仕事の補足。
// **別の仕事にいる社員が何をしているかは、誰も知らなかった。**
//
// 知識（lib/knowledge.js）とは役割を分ける：
//   知識   … 出典が要る「資産」。残す。関連度で引かれる。
//   掲示板 … 出典の要らない「業務連絡」。**30日で消える**。
// ここを混ぜると知識が薄まる。掲示板は「溜まるほど価値が上がる」ものではなく、
// **新しいものだけが見える**場所にしておく。

import { newId } from './id.js';

export const BOARD_TTL_DAYS = 30;
export const MAX_POSTS = 80;
export const MAX_TEXT = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

// 掲示の種類。画面の見た目と、社員に読ませるときの前置きに使う。
export const POST_KINDS = [
  { id: 'share', name: '共有', glyph: '◈', desc: '他の人が知っておくとよいこと' },
  { id: 'blocked', name: '詰まっている', glyph: '⚠', desc: '止まっていること・助けが要ること' },
  { id: 'decision', name: '決まったこと', glyph: '⚖', desc: 'オーナーが決めたこと' },
  { id: 'meeting', name: '会議の結論', glyph: '◎', desc: '会議で出た結論' },
  { id: 'consult', name: '相談の答え', glyph: '✎', desc: '他の担当に聞いた答え' },
];

export function kindById(id) {
  return POST_KINDS.find((k) => k.id === id) || POST_KINDS[0];
}

export function makePost({ text, kind = 'share', employeeId = null, employeeName = '', roleId = null, taskId = null }) {
  return {
    id: newId('post'),
    text: String(text || '').trim().slice(0, MAX_TEXT),
    kind: kindById(kind).id,
    employeeId,
    employeeName: String(employeeName || '').slice(0, 40),
    roleId,
    taskId,
    at: Date.now(),
  };
}

export function normalizeBoard(board) {
  return Array.isArray(board) ? board.filter((p) => p && p.id && p.text) : [];
}

/** 1件足す。同じ本文が既にあれば足さない（同じ仕事を2回実行した時のため）。 */
export function addPost(board, post) {
  const list = normalizeBoard(board);
  if (!post || !post.text) return list;
  if (list.some((p) => p.text === post.text && p.taskId === post.taskId)) return list;
  return [...list, post].slice(-MAX_POSTS);
}

export function removePost(board, id) {
  return normalizeBoard(board).filter((p) => p.id !== id);
}

/** まだ生きている掲示（30日以内）。新しい順。 */
export function livePosts(board, now = Date.now()) {
  const limit = now - BOARD_TTL_DAYS * DAY_MS;
  // 同じミリ秒に貼られたものは、**あとから貼った方を新しい**として扱う。
  // 時刻だけで並べると、同じ実行で出た掲示の順番が入れ替わって見える。
  return normalizeBoard(board)
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => (p.at || 0) >= limit)
    .sort((a, b) => b.p.at - a.p.at || b.i - a.i)
    .map(({ p }) => p);
}

/** 古いものを落とす（保存の前に1度だけ通す）。 */
export function prunePosts(board, now = Date.now()) {
  const limit = now - BOARD_TTL_DAYS * DAY_MS;
  return normalizeBoard(board).filter((p) => (p.at || 0) >= limit);
}

/**
 * 社員に読ませる文。**新しい方から数件だけ**。
 * 全部読ませると、掲示板が育つほど毎回のトークンが増えていく。
 */
export function boardPrompt(board, { now = Date.now(), limit = 8, exceptTaskId = null } = {}) {
  const list = livePosts(board, now)
    .filter((p) => !exceptTaskId || p.taskId !== exceptTaskId)
    .slice(0, limit);
  if (!list.length) return '';
  return [
    '## 社内で共有されていること（新しい順）',
    ...list.map((p) => `- 【${kindById(p.kind).name}】${p.employeeName ? `${p.employeeName}：` : ''}${p.text}`),
  ].join('\n');
}

// 「他の人が知っておくべきこと」を成果物から拾う語。
// ここに当たる行だけを1件、掲示板へ回す（AIをもう一度呼ばない）。
const SHARE_HINTS = [
  /共有/, /注意/, /気をつけ/, /分かった/, /判明/, /できなかった/, /見つから/,
  /使えな/, /古い/, /要確認/, /未確認/, /次は/, /次回/,
];
const BULLET = /^[\s>#*_・\-–—]*[①-⑳0-9０-９]*[.．、)）]?\s*/;

/**
 * 成果物から「共有する1行」を拾う（AI費用ゼロ）。
 * 見つからなければ空を返す——**無理に作らない**（中身の無い掲示は害になる）。
 */
export function extractShare(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.replace(BULLET, '').trim())
    .filter((l) => l.length >= 8 && l.length <= MAX_TEXT);
  for (const l of lines) {
    if (/^[#＃]/.test(l)) continue;
    if (SHARE_HINTS.some((re) => re.test(l))) return l;
  }
  return '';
}
