// データ整合性の自己修復（#2）— 削除済み問題を指す「孤立データ」を検出・掃除する。
//   純粋関数 computeOrphans で検出し、repairData で storage から実際に取り除く。
//   問題バンクに存在しない id を持つ srs/memos/links エントリだけを対象にする（安全側）。

// 孤立キーを検出（純粋）。questionIds: Set|配列 / srs,memos,links: id→値 のオブジェクト。
export function computeOrphans(questionIds, srs = {}, memos = {}, links = {}) {
  const valid = questionIds instanceof Set ? questionIds : new Set(questionIds || []);
  const orphanKeys = (obj) => Object.keys(obj || {}).filter((id) => !valid.has(id));
  return {
    srs: orphanKeys(srs),
    memos: orphanKeys(memos),
    links: orphanKeys(links),
  };
}

export function orphanCount(orphans) {
  return (orphans.srs?.length || 0) + (orphans.memos?.length || 0) + (orphans.links?.length || 0);
}

// オブジェクトから指定キーを取り除いた新オブジェクトを返す（純粋）
function omit(obj, keys) {
  if (!keys || keys.length === 0) return obj;
  const drop = new Set(keys);
  const out = {};
  for (const k of Object.keys(obj || {})) if (!drop.has(k)) out[k] = obj[k];
  return out;
}

// storage を読み込み→掃除→保存。取り除いた件数を返す。
//   storage は src/lib/storage.js（loadQuestions/loadSrs/saveSrs 等）を渡す。
export async function repairData(storage) {
  const [questions, srs, memos, links] = await Promise.all([
    storage.loadQuestions(),
    storage.loadSrs(),
    storage.loadMemos(),
    storage.loadLinks(),
  ]);
  // 問題バンクが読めない/空のときは誤削除を避けて何もしない
  if (!Array.isArray(questions) || questions.length === 0) {
    return { removed: 0, orphans: { srs: [], memos: [], links: [] }, skipped: true };
  }
  const ids = new Set(questions.map((q) => q.id));
  const orphans = computeOrphans(ids, srs, memos, links);
  const removed = orphanCount(orphans);
  if (removed > 0) {
    await storage.saveSrs(omit(srs, orphans.srs));
    await storage.saveMemos(omit(memos, orphans.memos));
    await storage.saveLinks(omit(links, orphans.links));
  }
  return { removed, orphans, skipped: false };
}
