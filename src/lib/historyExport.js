// 学習ログ（解答履歴）のCSV書き出し（②）。
// 問題データのCSV書き出し（importer.jsのexportCsv）とは別に、自分の解答履歴を
// 表計算ソフトで独自分析したい人向け。questionsは問題文・科目の補完にのみ使う。

function esc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function exportHistoryCsv(history, questions = []) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const header = ['日時', '科目', '問題文', '正誤', '出題元'];
  const lines = [header.join(',')];
  for (const h of history) {
    const q = byId.get(h.questionId);
    const row = [
      h.at ? new Date(h.at).toLocaleString('ja-JP') : '',
      h.subject || q?.subject || '',
      q?.question || '',
      h.correct ? '正解' : '不正解',
      h.source || '',
    ];
    lines.push(row.map(esc).join(','));
  }
  return lines.join('\n');
}
