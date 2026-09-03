// 別の端末へ渡す（提案29）。
//
// 決めていること
//  - **サーバーを持たない。** 文字列を自分でコピーして運ぶか、QR を読ませるだけ。
//    ネットワークには触れない（README 決まり7）。
//  - **QR に入りきらない時は、入ったふりをしない**（決まり「読めないものを読めるふりをしない」）。
//    入らなければ文字列での受け渡しを案内する。
//  - **取り込みは今あるものを消さない**（同じ日はあとから直したほうを残す＝`importAll` と同じ）。
//  - 記録がそのまま入っているので、**置き場所に気をつけて**と必ず書く。

const HEAD = 'chou1:';

/** UTF-8 を base64 へ（`btoa` は日本語をそのまま扱えない） */
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 渡す文字列を作る */
export function encodeTransfer(payload) {
  return HEAD + toBase64(JSON.stringify(payload));
}

/** 受け取る。**壊れていたら理由を返す**（黙って空にしない） */
export function decodeTransfer(text) {
  const s = String(text || '').trim();
  if (!s) return { ok: false, reason: '何も貼られていません。' };
  if (!s.startsWith(HEAD)) {
    return { ok: false, reason: 'このアプリの受け渡しの文字列ではないようです。' };
  }
  try {
    const json = fromBase64(s.slice(HEAD.length));
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return { ok: false, reason: '中身を読み取れませんでした。' };
    return { ok: true, data, reason: '' };
  } catch {
    return { ok: false, reason: '途中で切れているかもしれません。もう一度コピーし直してください。' };
  }
}

/** QR に入る目安（誤り訂正 L のバイト数上限に少し余裕を持たせた値） */
export const QR_LIMIT = 2600;

export function fitsInQr(text) {
  return String(text || '').length <= QR_LIMIT;
}

export const TRANSFER_NOTE =
  'この文字列には、この端末に入っている記録がそのまま入っています。'
  + 'メールやチャットに貼ると、その先に残ります。置き場所に気をつけてください。';

export const TRANSFER_TOO_BIG =
  '記録が多いので、QR には入りませんでした。文字列をコピーして渡すか、'
  + '設定の「ファイルに書き出す」を使ってください（そちらは大きさの制限がありません）。';
