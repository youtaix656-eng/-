// 経絡経穴概論の教科書ページ範囲ごとに、実際に収録済みの過去問（keizetsuQuestions.js、
// 第25〜34回・genreタグつき）から出題頻度を集計する。
//
// 新しく過去問PDFを読んで捏造するのではなく、既存の「過去問→教材化」パイプラインで
// 既に検証済みの genre タグを再利用する（同じ会話内の記憶で頻度を作らない）。

import { roundKey, formatRound } from './round.js';

export const FREQ_THRESHOLDS = { hot: 15, warm: 5, cool: 1 };

function matchesSection(section, genre) {
  if (!genre || !section.genrePrefixes || section.genrePrefixes.length === 0) return false;
  return section.genrePrefixes.some((p) => genre.startsWith(p));
}

function levelFor(count) {
  if (count >= FREQ_THRESHOLDS.hot) return 'hot';
  if (count >= FREQ_THRESHOLDS.warm) return 'warm';
  if (count >= FREQ_THRESHOLDS.cool) return 'cool';
  return 'none';
}

// sections: KEIZETSU_TEXTBOOK_SECTIONS、questions: store.questions（全科目混在でよい、内部で絞り込む）
export function computeSectionFrequency(sections, questions) {
  const keizetsuQs = (questions || []).filter((q) => q.subject === '経絡経穴概論' && q.genre);
  return sections.map((section) => {
    const matched = keizetsuQs.filter((q) => matchesSection(section, q.genre));
    const rounds = [...new Set(matched.map((q) => q.round).filter((r) => r != null))]
      .sort((a, b) => roundKey(a) - roundKey(b));
    return {
      ...section,
      count: matched.length,
      rounds,
      roundsLabel: rounds.length > 0 ? rounds.map(formatRound).join('・') : null,
      level: levelFor(matched.length),
    };
  });
}
