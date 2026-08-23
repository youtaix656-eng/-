// 「人に説明するつもりで書く」ノート — マスター済みの問題から日替わりで1問選び、
//   自分の言葉で説明を書いて蓄積する（ファインマン式のアウトプット練習）。
//   誤答時に促す自己説明（whyPrompt、quiz-why）とは対象を分ける：
//   あちらは「間違えた直後」、こちらは「もう定着したはずの問題を人に教えられるか」の確認。
//   端末内のみ（外部送信なし）。

import { idbGet, idbSet } from './db.js';
import { isMastered } from './srs.js';
import { dateKey, dailyPick } from './connect.js';

const KEY = 'shinkyu:explainNotes'; // 配列 [{id, questionId, text, at}]（新しい順）
const MAX = 300;

// マスター済みの問題から日替わりで1問選ぶ（同じ日・同じ母集団なら常に同じ問題）
export function pickExplainQuestion(questions, srs, today = dateKey()) {
  const mastered = (questions || []).filter((q) => isMastered((srs || {})[q.id]));
  if (mastered.length === 0) return null;
  return dailyPick(mastered, `explain:${today}`);
}

export async function loadExplainNotes() {
  try { return (await idbGet(KEY)) || []; } catch (e) { return []; }
}

export async function saveExplainNote(questionId, text) {
  const all = await loadExplainNotes();
  const next = [
    { id: `ex-${Date.now().toString(36)}`, questionId, text: String(text).trim(), at: Date.now() },
    ...all,
  ].slice(0, MAX);
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}
