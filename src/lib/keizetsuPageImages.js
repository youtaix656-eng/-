// 経絡経穴の教科書ページ写真（端末内限定）— 追加・削除・並び替えのロジック。
//
// ここに保存するのはユーザーが自分の端末で撮った／選んだ画像そのもの。
// 公開リポジトリ（GitHub Pages）には一切含まれず、この端末のIndexedDBにのみ残る
// （storage.js の keizetsuPageImages・exportAll からも除外）。

let seq = 0;
function makeId() {
  seq += 1;
  return `kpi-${Date.now().toString(36)}-${seq}`;
}

// 新しい画像エントリを作る。pageNumber は正の整数のみ有効（それ以外は null＝ページ不明）。
// dataUrl は lib/image.js の fileToDataUrl() で縮小済みの JPEG data URI を想定。
export function makeImageEntry({ pageNumber, label, dataUrl }) {
  const p = Number(pageNumber);
  return {
    id: makeId(),
    pageNumber: Number.isFinite(p) && p > 0 ? Math.floor(p) : null,
    label: (label || '').trim(),
    dataUrl,
    addedAt: Date.now(),
  };
}

export function addImageEntry(entries, entry) {
  return [...(entries || []), entry];
}

export function removeImageEntry(entries, id) {
  return (entries || []).filter((e) => e.id !== id);
}

// ページ番号順（不明なページは末尾・新しい順）に並べる。
export function sortByPage(entries) {
  return [...(entries || [])].sort((a, b) => {
    if (a.pageNumber == null && b.pageNumber == null) return b.addedAt - a.addedAt;
    if (a.pageNumber == null) return 1;
    if (b.pageNumber == null) return -1;
    return a.pageNumber - b.pageNumber;
  });
}

// 指定したページ範囲（pageStart〜pageEnd、両端含む）に属する画像だけを返す。
export function imagesInRange(entries, pageStart, pageEnd) {
  return (entries || []).filter(
    (e) => e.pageNumber != null && e.pageNumber >= pageStart && e.pageNumber <= pageEnd
  );
}
