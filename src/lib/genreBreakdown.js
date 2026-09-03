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
  // 並び順はラプラススムージング（(correct+1)/(total+2)）の昇順にする。全科目セッション等では
  // ほとんどのジャンルがn=1になりがちで、素の正答率だけで並べると「たまたま1問外しただけ」の
  // ジャンルが0%として最上位（最も苦手扱い）に来てしまう。表示する数値（正答率・件数）自体は
  // 素のcorrect/totalのまま変えない。
  const smoothed = (s) => (s.correct + 1) / (s.total + 2);
  return Object.entries(byGenre).sort((x, y) => smoothed(x[1]) - smoothed(y[1]));
}
