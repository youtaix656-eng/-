// フラッシュカード（経穴カード）専用のSRS（③）— 「覚えた/まだ」を記録し、
//   苦手なカードだけを優先的に出題できるようにする。
//   一問一答の本体SRS（store.srs、questionのid単位）とは別の状態を持つ
//   （経穴カードはquestions配列に属さない別データのため、質問の正誤とは独立に管理する）。
//   端末内のみ（外部送信なし）。ロジックはsrs.jsの汎用関数（applyAnswer/isInReview/isMastered）を再利用する。

import { idbGet, idbSet } from './db.js';
import { applyAnswer, isInReview, isMastered, normalize } from './srs.js';

const KEY = 'shinkyu:flashcardSrs'; // { [cardId]: srsState }

export async function loadFlashcardSrs() {
  try { return (await idbGet(KEY)) || {}; } catch (e) { return {}; }
}

export async function gradeFlashcard(cardId, correct) {
  const all = await loadFlashcardSrs();
  const next = { ...all, [cardId]: applyAnswer(all[cardId], correct) };
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

// 苦手（一度でも「まだ」を選び、まだマスターしていない）カードのIDだけを返す
export function weakCardIds(srsMap, allIds) {
  return allIds.filter((id) => isInReview(srsMap[id]));
}

export function cardMastered(srsMap, cardId) {
  return isMastered(srsMap[cardId]);
}

export function cardWrongCount(srsMap, cardId) {
  return normalize(srsMap[cardId]).wrongCount || 0;
}
