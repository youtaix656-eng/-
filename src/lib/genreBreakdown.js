// 完了画面の「ジャンル別正答率（苦手順）」集計。Quiz.jsx・Session.jsx・Review.jsx・Exam.jsxの
//   完了画面がそれぞれ独自に同じ集計＋並び替え（正答率の低い順）を実装していたため切り出した
//   単一の正。呼び出し側は自分の持つ解答データを { genre, correct } の配列に変換してから渡す。
export function buildGenreBreakdown(pairs) {
  const byGenre = {};
  for (const { genre, correct } of pairs) {
    const g = genre || 'その他';
    if (!byGenre[g]) byGenre[g] = { total: 0, correct: 0 };
    byGenre[g].total += 1;
    if (correct) byGenre[g].correct += 1;
  }
  return Object.entries(byGenre).sort((x, y) => (x[1].correct / x[1].total) - (y[1].correct / y[1].total));
}
