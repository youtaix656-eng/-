// 読み方の手動補正辞書（settings.pronunciationFixes）はtermをキーにした辞書そのものなので、
// 「いつ・何を報告したか」という履歴を持たない（上書きされると前の記録は消える）。
// これは辞書とは別に、報告の履歴だけを残す単一の発生源。
import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:pronunciationReportLog';
const MAX = 100;

export async function loadPronunciationReportLog() {
  const v = await idbGet(KEY);
  return Array.isArray(v) ? v : [];
}

export async function appendPronunciationReportLog(entry) {
  const list = await loadPronunciationReportLog();
  const next = [{ at: Date.now(), ...entry }, ...list].slice(0, MAX);
  await idbSet(KEY, next);
  return next;
}
