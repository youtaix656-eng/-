// Q&A（faq.js）の検索。外部ランタイム依存なし・形態素解析ライブラリを使わない方針のため、
// 「単語1語」の検索と「文章まるごと」の検索を両方それなりに拾えるよう、
// 部分一致（強い・優先）と2文字N-gramの一致率（弱い・文章向け）を組み合わせる。
//
// 例：「ログイン」だけでも、「Googleのログイン画面が毎回出て邪魔」のような文章を
// そのまま貼り付けても、それらしい候補が上位に出ることを狙う。

function normalize(s) {
  return String(s || '').toLowerCase().trim();
}

function bigrams(s) {
  if (s.length < 2) return [s];
  const out = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

// 文章検索でノイズ（ほとんど関係ない項目）を出さないための最低一致率。
const MIN_NGRAM_RATIO = 0.34;

export function searchFaq(list, rawQuery) {
  const q = normalize(rawQuery);
  if (!q) return list;
  const qGrams = bigrams(q);
  const scored = [];
  for (const item of list) {
    const hay = normalize([item.question, item.answer, item.category, ...(item.tags || [])].join(' '));
    const directHit = hay.includes(q);
    const hitGrams = qGrams.filter((g) => hay.includes(g)).length;
    const ratio = hitGrams / qGrams.length;
    if (!directHit && ratio < MIN_NGRAM_RATIO) continue;
    const score = directHit ? 1 + ratio : ratio;
    scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
