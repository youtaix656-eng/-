// 声で解答モード（AudioMode.jsxのvoiceAnswerOn）で、聞き取った内容が正解と一致しなかった時
// だけ記録する発生源（端末内のみ）。間違えた時に「何と答えてしまったか」をあとで
// 振り返れるようにする（正解した時は記録しない——件数が増えすぎるのを防ぐため）。

import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:voiceAnswerLog';
const MAX_ENTRIES = 60;

export async function loadVoiceAnswerLog() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

// entry: { questionId, heard, target }
export async function recordVoiceAnswerMiss(entry) {
  const log = await loadVoiceAnswerLog();
  const next = [{ ...entry, at: Date.now() }, ...log].slice(0, MAX_ENTRIES);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 直近◯件（新しい順）。振り返り一覧の表示に使う。
export function recentVoiceAnswerMisses(log, limit = 20) {
  return (log || []).slice(0, limit);
}
