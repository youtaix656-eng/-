// 端末間の進捗の受け渡し（QR／URLハッシュ）。
// 問題バンク・画像・音声ファイルは含めない（受け取り側で同梱分が再生成されるため軽量に保つ）。

function b64UrlEncode(str) {
  const b64 = btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode('0x' + p))
  );
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64UrlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(
    atob(s)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

// バックアップ全体 → 軽量ペイロード（キーを短縮して容量節約）
export function buildSyncPayload(data, { includeHistory = true } = {}) {
  const p = { v: 1 };
  if (data.srs && Object.keys(data.srs).length) p.s = data.srs;
  if (includeHistory && Array.isArray(data.history) && data.history.length) p.h = data.history;
  if (data.memos && Object.keys(data.memos).length) p.m = data.memos;
  if (data.links && Object.keys(data.links).length) p.l = data.links;
  if (Array.isArray(data.examResults) && data.examResults.length) p.e = data.examResults;
  if (data.settings) p.g = data.settings;
  return p;
}

export function encodeSync(payload) {
  return b64UrlEncode(JSON.stringify(payload));
}
export function decodeSync(str) {
  const obj = JSON.parse(b64UrlDecode(str));
  if (!obj || obj.v !== 1) throw new Error('未対応のデータ形式です');
  return obj;
}

// 軽量ペイロード → importAll が受け取れるバックアップ形式へ
export function syncToBackup(p) {
  const b = {};
  if (p.s) b.srs = p.s;
  if (p.h) b.history = p.h;
  if (p.m) b.memos = p.m;
  if (p.l) b.links = p.l;
  if (p.e) b.examResults = p.e;
  if (p.g) b.settings = p.g;
  return b;
}

// 受け渡し用URL（このURLをQRにする。カメラで読み取ると別端末で開いて取り込める）
export function syncUrl(encoded) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#sync=${encoded}`;
}
