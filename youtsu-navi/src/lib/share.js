// 共有・書き出しのブラウザ側の実装（端末の機能を呼ぶだけで、外部への送信は行わない）。
//
// 共有シート（navigator.share）を使うと、その先はOSの共有機能＝施術者本人の操作で
// どこへ渡すかが決まる。アプリが勝手に外部へ送ることはない。

/** クリップボードへコピー。失敗したら false（呼び出し側で手動コピー用の表示に切り替える） */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 続けてフォールバックを試す */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 端末の共有シート。非対応なら false を返す（呼び出し側はコピーへ切り替える） */
export async function shareText(text, title = '腰痛ナビ') {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title, text });
    return true;
  } catch {
    // ユーザーがキャンセルした場合もここに来る。エラー表示はしない。
    return false;
  }
}

/** テキストをファイルとして保存する */
export function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ファイルを選んでテキストとして読む */
export function pickTextFile(accept = 'application/json,.json') {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, text: String(reader.result || '') });
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}

/** 印刷用に新しいウィンドウを開く（お客様へ紙で渡す時） */
export function printText(title, text) {
  const w = window.open('', '_blank');
  if (!w) return false;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  w.document.write(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title>` +
      '<style>body{font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;font-size:15px;line-height:1.9;' +
      'white-space:pre-wrap;padding:24px;max-width:640px;margin:0 auto;color:#111;background:#fff}</style>' +
      `</head><body>${esc(text)}</body></html>`,
  );
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
