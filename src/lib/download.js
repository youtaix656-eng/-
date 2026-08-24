// テキストデータをファイルとしてブラウザにダウンロードさせる共通ヘルパー。
// 外部ライブラリなし（Blob + 一時的な<a download>要素）。

export function downloadFile(content, filename, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
