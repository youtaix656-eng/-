// 書き出し・共有・印刷（提案13・28、追加依頼1・2）。
//
// 決めていること
//  - **共有シートが使えない端末では、今までどおりダウンロードへ落とす**
//    （押しても何も起きないボタンを出さない）。
//  - **どこへ送るかはアプリが決めない。** 渡す先を選ぶのは人で、
//    アプリ自身はネットワークに触れない（README 決まり7。ここは `src/lib` ではなく
//    ブラウザの機能を呼ぶだけなので、送信先も内容もアプリは知らない）。
//  - **共有する中身に、記録がそのまま入ることを必ず伝える。**
//  - 印刷は**白い紙に黒い字**で開く（画面の見た目をそのまま紙にしない）。

export function canShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function canShareFiles() {
  return (
    canShare()
    && typeof navigator.canShare === 'function'
    && typeof File !== 'undefined'
  );
}

/** 文字をそのまま渡す。断られた・使えない時は false（**黙って諦めない**＝呼び出し側が落とす） */
export async function shareText({ title, text }) {
  if (!canShare()) return false;
  try {
    await navigator.share({ title, text });
    return true;
  } catch {
    return false;
  }
}

/** ファイルとして渡す（使えなければ false） */
export async function shareFile({ title, filename, text, type = 'text/plain' }) {
  if (!canShareFiles()) return false;
  try {
    const file = new File([text], filename, { type });
    if (!navigator.canShare({ files: [file] })) return false;
    await navigator.share({ title, files: [file] });
    return true;
  } catch {
    return false;
  }
}

/** いつものダウンロード（共有が使えない時の受け皿） */
export function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  if (typeof document === 'undefined') return false;
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** 差し込む文字を、そのままタグとして読ませない */
export function escapeHtml(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 印刷用のページを作る。**白い紙に黒い字**で、飾りを持たない。
 * 画面の色をそのまま持っていくと、黒地のままインクを大量に使うことになる。
 */
export function printHtml(title, body) {
  return [
    '<!doctype html><html lang="ja"><head><meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    'html,body{background:#fff;color:#000;margin:0;padding:16mm 14mm;}',
    'body{font-family:"Hiragino Mincho ProN",serif;font-size:11.5pt;line-height:1.8;}',
    'h1{font-size:15pt;margin:0 0 8mm;border-bottom:1px solid #000;padding-bottom:3mm;}',
    'pre{white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:inherit;margin:0;}',
    '.foot{margin-top:10mm;border-top:1px solid #000;padding-top:3mm;font-size:9pt;}',
    '@page{margin:14mm;}',
    '</style></head><body>',
    `<h1>${escapeHtml(title)}</h1>`,
    `<pre>${escapeHtml(body)}</pre>`,
    '<div class="foot">腸（ちょう）で作った記録です。この紙には、書いたものがそのまま出ています。</div>',
    '</body></html>',
  ].join('');
}

/**
 * 別のタブで開いて印刷する。**開けなかったら false**（ポップアップを止めている端末がある）。
 * 呼び出し側は false のときに「うまく開けませんでした」と出す。
 */
export function printText(title, body) {
  if (typeof window === 'undefined') return false;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(printHtml(title, body));
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* 印刷の画面を出せない端末では、開いたページをそのまま残す */
    }
  }, 200);
  return true;
}

export const SHARE_NOTE =
  '渡した先には、書いたものがそのまま残ります。送り先を選ぶのはあなたです。';

export const PRINT_NOTE =
  '白い紙に黒い字で開きます。印刷のダイアログから「PDFに保存」を選ぶこともできます。';

export const PRINT_FAILED = '印刷の画面を開けませんでした。ブラウザがポップアップを止めているかもしれません。';
