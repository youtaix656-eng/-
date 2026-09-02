// 学習ログ（解答履歴）のCSV書き出し（②）。
// 問題データのCSV書き出し（importer.jsのexportCsv）とは別に、自分の解答履歴を
// 表計算ソフトで独自分析したい人向け。questionsは問題文・科目の補完にのみ使う。

import { latestMissType, missTypeLabel } from './missTypes.js';
import { starLevelOf, starLabel } from './starWeak.js';

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// missTypes/selfKindCountsは省略可（後方互換）。渡すと誤答理由の型・★の段階も列に足す
// （これまでCSVには含まれておらず、せっかく記録している情報が書き出しで欠落していた）。
export function exportHistoryCsv(history, questions = [], { missTypes = {}, selfKindCounts = {} } = {}) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const header = ['日時', '科目', '問題文', '正誤', '出題元', '誤答理由の型', '★段階'];
  const lines = [header.join(',')];
  for (const h of history) {
    const q = byId.get(h.questionId);
    const type = latestMissType(missTypes[h.questionId])?.type;
    const starLv = starLevelOf(selfKindCounts[h.questionId]);
    const row = [
      h.at ? new Date(h.at).toLocaleString('ja-JP') : '',
      h.subject || q?.subject || '',
      q?.question || '',
      h.correct ? '正解' : '不正解',
      h.source || '',
      type ? missTypeLabel(type) : '',
      starLv > 0 ? starLabel(starLv) : '',
    ];
    lines.push(row.map(esc).join(','));
  }
  return lines.join('\n');
}
