// セルフケア・体調メモを「端末だけに」取り込むためのリンク用エンコード。
//
// メモ本文は公開リポジトリのソースには置かず、URL の #notes=... に載せて渡す。
// リンクを一度開くと、その端末のローカル保存にだけ書き込まれる（非公開）。

// UTF-8 セーフな base64url
export function encodeNotes(notes) {
  const json = JSON.stringify(notes);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeNotes(str) {
  try {
    let b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

// 現在の URL ハッシュ（#notes=...）からメモ配列を取り出す。無ければ null。
export function readSeedFromHash(hash = (typeof location !== 'undefined' ? location.hash : '')) {
  const m = /[#&]notes=([^&]+)/.exec(hash || '');
  if (!m) return null;
  const notes = decodeNotes(m[1]);
  return notes.length ? notes : null;
}

// 取り込み後にハッシュを消す（本文をURL/履歴に残さない）
export function clearSeedHash() {
  try {
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    } else if (typeof location !== 'undefined') {
      location.hash = '';
    }
  } catch (e) {
    /* noop */
  }
}
