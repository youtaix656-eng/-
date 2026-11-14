// 音声学習×連結学習の#64「連続2回同じ問題を外したら、その場で一度だけ言い換えて再読」が
// 実際に発生した記録（単一の発生源）。週次の弱点ジャーナルの自動チップ化だけに使う、
// 端末内のみの軽量ログ（他のログと同じ「先頭に追加して上限でslice」パターン）。
import { idbGet, idbSet } from './db.js';

const KEY = 'shinkyu:rephraseLog';
const MAX = 100;

export async function loadRephraseLog() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

export async function recordRephrase(questionId) {
  const log = await loadRephraseLog();
  const next = [{ questionId, at: Date.now() }, ...log].slice(0, MAX);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 直近◯日の発生件数（週次の弱点ジャーナル向け）。
export function rephraseCountSince(log, sinceMs) {
  return (log || []).filter((e) => e.at >= sinceMs).length;
}
