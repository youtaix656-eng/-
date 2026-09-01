// 過去問の「回」ごとの収録抜け漏れ検知（#13）。
// 科目ごとに「この回は絶対出るべき」という公式基準は手元に無いので、他の科目で
// 実際に収録されている回を「その回のPDFは処理された」という状況証拠として使い、
// 特定の科目だけその回を欠いていれば「その科目のその回のPDFがまだ未処理では」と
// 示唆する（手元に無い基準を作らず、実データの相対比較だけで見つける）。

import { pastExamQuestions } from './pastExamTrends.js';
import { roundKey } from './round.js';

// 科目ごとの収録済み回一覧。Map<subject, Set<roundKey>>
export function roundsBySubject(questions) {
  const map = new Map();
  for (const q of pastExamQuestions(questions)) {
    const rk = roundKey(q.round);
    if (!rk) continue;
    if (!map.has(q.subject)) map.set(q.subject, new Set());
    map.get(q.subject).add(rk);
  }
  return map;
}

// 全科目を通じて実際に収録されている回の一覧（新しい順）。
export function allRounds(questions) {
  const bySubject = roundsBySubject(questions);
  const all = new Set();
  for (const set of bySubject.values()) for (const r of set) all.add(r);
  return Array.from(all).sort((a, b) => Number(b) - Number(a));
}

// 科目ごとの「抜けている回」を返す（収録が0件の科目は対象外＝それは網羅マップの「未収録」で分かる）。
//   [{ subject, missing: [roundKey...], collected: [roundKey...] }]（missingが多い順）
// minOtherSubjects未満の科目にしか無い回は「そもそも全科目共通の回ではない」可能性があるため対象外。
export function roundGapsBySubject(questions, { minOtherSubjects = 3 } = {}) {
  const bySubject = roundsBySubject(questions);
  const rounds = allRounds(questions);
  const subjects = Array.from(bySubject.keys());
  const countHavingRound = (r) => subjects.filter((s) => bySubject.get(s).has(r)).length;
  const commonRounds = rounds.filter((r) => countHavingRound(r) >= minOtherSubjects);
  const result = [];
  for (const [subject, set] of bySubject.entries()) {
    const missing = commonRounds.filter((r) => !set.has(r));
    if (missing.length > 0) {
      result.push({
        subject,
        missing,
        collected: Array.from(set).sort((a, b) => Number(b) - Number(a)),
      });
    }
  }
  return result.sort((a, b) => b.missing.length - a.missing.length);
}
