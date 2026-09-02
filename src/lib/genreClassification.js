// 問題1件の「ジャンル（大項目｜中項目）」判定と、そこから大項目だけを取り出す処理。
// coverage.js（網羅マップ）とpastExamTrends.js（頻出度分析）の両方が同じ判定を必要とするため、
// どちらか一方に置くと循環importになる（pastExamTrends.jsはcoverage.jsのdaikoumokuを使い、
// coverage.jsは医療概論のgenre復元にpastExamTrends.js相当の判定を使いたい）ので、
// 共通の置き場としてここへ切り出す。

// 医療概論だけは genre（出題基準カテゴリ）を持たない設計（過去の変更でtagsへ折り込み済み。
// 「医療概論=iryouQuestions.jsのみ未使用」という既存仕様）。tagsには元々「大項目」「中項目」の
// 名称がキーワードと一緒に含まれているので、既知の出題基準（examScope.jsのoutline）と照合して
// tagsから大項目｜中項目を復元する。復元できない場合はnull（当てずっぽうな分類はしない）。
const IRYOU_OUTLINE = {
  '現代の医療と社会': ['医療と社会', '医療従事者', '医療・福祉施設', '医療経済'],
  '社会保障制度': ['医療保険のしくみ', '公費負担医療', '介護サービス行政'],
  '医療倫理': ['医療の倫理', '医療倫理教育', '施術者としての倫理'],
};

function iryouGenreFromTags(tags) {
  const set = new Set(tags || []);
  for (const [dai, mids] of Object.entries(IRYOU_OUTLINE)) {
    if (!set.has(dai)) continue;
    const mid = mids.find((m) => set.has(m));
    if (mid) return `${dai}｜${mid}`;
  }
  return null;
}

// 問題1件のジャンル（大項目｜中項目）。genreがあればそのまま、無くて医療概論ならtagsから復元する。
export function genreOf(q) {
  if (q.genre) return q.genre;
  if (q.subject === '医療概論') return iryouGenreFromTags(q.tags);
  return null;
}

// genre（"大項目｜中項目"）から大項目を取り出す
export function daikoumoku(genre) {
  const g = String(genre || '').trim();
  if (!g) return '（未分類）';
  return g.split('｜')[0].trim() || '（未分類）';
}
