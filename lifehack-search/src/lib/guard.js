// 言い方の見張り — **止めない・書き換えない。知らせるだけ**。
//
// ライフハックは「必ず効く」「誰でもできる」と書きたくなるが、効きめは人によって違う。
// 断定はそのまま人を追い込む形になるので、データを足す時に一度目を通す所として出す。
// （腰痛ナビ・Ouro の見張りと同じ線：誤検知で書けなくなるほうが害が大きい）

import { OVERPROMISE_WORDS, CAUTION_WORDS } from '../data/schema.js';

/** 1件ぶんの本文（見張りの対象になる場所だけ） */
export function textOf(hack) {
  return [hack.title, hack.summary, ...(hack.steps || []), hack.why, hack.caution].filter(Boolean).join('\n');
}

/**
 * 言い切り・医療やお金の断定が入っていないかを見る。
 * @returns {Array<{kind:string, word:string, note:string}>} 空なら見直す所は無かった
 */
export function checkPhrasing(hack) {
  const text = textOf(hack);
  const found = [];
  for (const word of OVERPROMISE_WORDS) {
    if (text.includes(word)) {
      found.push({ kind: 'overpromise', word, note: '効きめは人によって違う。「合う人には合う」の言い方にする。' });
    }
  }
  for (const word of CAUTION_WORDS) {
    if (text.includes(word) && !hack.caution) {
      found.push({ kind: 'caution', word, note: '判断を人にゆだねる一文（受診・専門家へ相談）を caution に足す。' });
    }
  }
  return found;
}

/** 全件を見て、見直す所がある項目だけ返す */
export function auditHacks(hacks = []) {
  return hacks
    .map((hack) => ({ hack, findings: checkPhrasing(hack) }))
    .filter((row) => row.findings.length > 0);
}
