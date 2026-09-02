// 読み取れないリスト（※1）— 過去問PDFの一部ページが読み取れなかった時に、
//   日付・科目・印刷ページ番号を控えておくメモ（CLAUDE.mdの標準変換プロンプト手順⑨）。
//   後で読み取れたら該当項目を消す（削除した旨は必ずユーザーへ連絡する運用）。
//   端末内のみ（外部送信なし）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:unreadablePages';

export async function loadUnreadablePages() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

// entry: { subject, note }（noteに印刷ページ番号・タイトル等を自由記述）
export async function addUnreadablePage(entry) {
  const list = await loadUnreadablePages();
  const next = [{ id: `up-${Date.now().toString(36)}`, at: Date.now(), ...entry }, ...list];
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 読み取れるようになったら削除する（CLAUDE.mdの運用どおり、消したらユーザーへ連絡すること）。
export async function removeUnreadablePage(id) {
  const list = await loadUnreadablePages();
  const next = list.filter((e) => e.id !== id);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}
