// 語呂合わせの想起テスト（④）専用のSRS — 語呂合わせ本文を見て見出し語(keyword)を
//   思い出せるかを「覚えた/まだ」で記録し、苦手な語呂合わせだけに絞れるようにする。
//   一問一答の本体SRSやフラッシュカードSRSとは別データ（keyword単位で管理）。
//   端末内のみ（外部送信なし）。ロジックはsrs.jsの汎用関数を再利用する。

import { idbGet, idbSet } from './db.js';
import { applyAnswer, isInReview, isMastered, normalize } from './srs.js';

const KEY = 'shinkyu:mnemonicSrs'; // { [keyword]: srsState }

export async function loadMnemonicSrs() {
  try { return (await idbGet(KEY)) || {}; } catch (e) { return {}; }
}

export async function gradeMnemonic(keyword, correct) {
  const all = await loadMnemonicSrs();
  const next = { ...all, [keyword]: applyAnswer(all[keyword], correct) };
  try { await idbSet(KEY, next); } catch (e) { /* noop */ }
  return next;
}

export function weakMnemonicKeywords(srsMap, allKeywords) {
  return allKeywords.filter((k) => isInReview(srsMap[k]));
}

export function mnemonicMastered(srsMap, keyword) {
  return isMastered(srsMap[keyword]);
}

export function mnemonicWrongCount(srsMap, keyword) {
  return normalize(srsMap[keyword]).wrongCount || 0;
}
