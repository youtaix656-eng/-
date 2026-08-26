// 画面の読み込みを1か所にまとめる（新項目01・02）。
//
// lazy() に渡す関数と「押す前に取っておく」先読みが同じものを指すようにする。
// 別々に書くと、先読みしたのに lazy() が別のチャンクを取りに行って二度手間になる。

export const LOADERS = {
  toc: () => import('../components/Toc.jsx'),
  calendar: () => import('../components/Calendar.jsx'),
  genre: () => import('../components/GenreEditor.jsx'),
  characters: () => import('../components/Characters.jsx'),
  task: () => import('../components/TaskDetail.jsx'),
  employee: () => import('../components/EmployeeDetail.jsx'),
  hire: () => import('../components/Hire.jsx'),
  knowledgeDetail: () => import('../components/KnowledgeDetail.jsx'),
  ingest: () => import('../components/Ingest.jsx'),
  meeting: () => import('../components/Meeting.jsx'),
  meetingDetail: () => import('../components/Meeting.jsx'),
  company: () => import('../components/Company.jsx'),
  ledger: () => import('../components/Ledger.jsx'),
  funnel: () => import('../components/Funnel.jsx'),
  rules: () => import('../components/Rules.jsx'),
  deals: () => import('../components/Deals.jsx'),
  deal: () => import('../components/Deals.jsx'),
  connect: () => import('../components/Connect.jsx'),
  approvals: () => import('../components/Approvals.jsx'),
  audit: () => import('../components/AuditView.jsx'),
  settings: () => import('../components/Settings.jsx'),
};

const started = new Set();

/**
 * 通信を使ってよい状況か。
 * 節約モード・2G相当のときは先読みしない（本命の通信の邪魔になるため）。
 * 押したときの読み込みは、この判定に関係なく必ず走る。
 */
export function shouldPrefetch() {
  if (typeof navigator === 'undefined') return false;
  const c = navigator.connection;
  if (!c) return true;
  if (c.saveData) return false;
  return !/(^|-)2g$/.test(String(c.effectiveType || ''));
}

/**
 * その画面のチャンクを先に取っておく（新項目01）。
 * 指が触れた時点で呼ぶので、押した時にはもう手元にあることが多い。
 * 失敗しても黙って諦める（押した時に改めて読みに行く）。
 */
export function preloadView(name) {
  const loader = LOADERS[name];
  if (!loader || started.has(name)) return;
  started.add(name);
  try {
    const p = loader();
    if (p && typeof p.catch === 'function') p.catch(() => started.delete(name));
  } catch {
    started.delete(name);
  }
}

/** まだ読んでいない画面をまとめて先読みする（暇な時に呼ぶ／新項目02）。 */
export function preloadMany(names) {
  if (!shouldPrefetch()) return;
  for (const n of names) preloadView(n);
}

/** テスト用：先読み済みの記録を消す。 */
export function resetPreload() {
  started.clear();
}
