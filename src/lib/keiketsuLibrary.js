// 経絡経穴の教科書材料（原文の置き場）— 検索・追加・削除のロジック。
//
// ここが持つのはユーザーが貼り付けた「原文（下書き）」であり、経穴の医療的事実そのもの
// ではない。実際の経穴データ（data/keiketsuCards.js）は、この原文を出典として
// Claudeが出典つきで手動整備する（このライブラリの原文を直接クイズ化する自動処理は持たない
// ＝ CLAUDE.md の「過去問PDFの内容を記憶で再現しない／文章そのものはコピーしない」方針と、
// 「データは直接ファイルを編集する」方針の両方を守るため）。

let seq = 0;
function makeId() {
  seq += 1;
  return `kl-${Date.now().toString(36)}-${seq}`;
}

// 新しいページ（原文）を作る。title・text は前後の空白を除く。
export function makePage({ title, text }) {
  const t = (title || '').trim();
  const body = (text || '').trim();
  return {
    id: makeId(),
    title: t || '（無題）',
    text: body,
    addedAt: Date.now(),
  };
}

export function addPage(pages, page) {
  return [...(pages || []), page];
}

export function removePage(pages, id) {
  return (pages || []).filter((p) => p.id !== id);
}

// クエリに一致する箇所の前後を切り出したスニペットを作る（一覧でのプレビュー用）。
export function snippetFor(text, query, radius = 40) {
  if (!text) return '';
  if (!query) return text.slice(0, radius * 2);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

// title・text の部分一致で検索する（大文字小文字を区別しない）。空クエリは全件を返す。
export function searchPages(pages, query) {
  const q = (query || '').trim();
  if (!q) return pages || [];
  const ql = q.toLowerCase();
  return (pages || []).filter(
    (p) => p.title.toLowerCase().includes(ql) || p.text.toLowerCase().includes(ql)
  );
}
