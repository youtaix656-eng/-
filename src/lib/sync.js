// 端末間の進捗の受け渡し（QR／URLハッシュ）。
// 問題バンク・画像・音声ファイルは含めない（受け取り側で同梱分が再生成されるため軽量に保つ）。
//
// 符号化は src/lib/transferCodec.js（圧縮＋効率的なbase64url化）に委譲する。
// 大きなデータは src/lib/chunk.js で分割し、複数のQR／テキストブロックに分けて送れる。

import { encodeTransferString, decodeTransferString } from './transferCodec.js';

// 受け渡し（QR／URL）の有効期限：発行から5分間だけ使える（安全のため）
export const SYNC_TTL_MS = 5 * 60 * 1000;

// バックアップ全体 → 軽量ペイロード（キーを短縮して容量節約）
export function buildSyncPayload(data, { includeHistory = true } = {}) {
  // t = 発行時刻（秒）。受け取り側で5分以内かどうかを判定する。
  const p = { v: 1, t: Math.floor(Date.now() / 1000) };
  if (data.srs && Object.keys(data.srs).length) p.s = data.srs;
  if (includeHistory && Array.isArray(data.history) && data.history.length) p.h = data.history;
  if (data.memos && Object.keys(data.memos).length) p.m = data.memos;
  if (data.links && Object.keys(data.links).length) p.l = data.links;
  if (Array.isArray(data.examResults) && data.examResults.length) p.e = data.examResults;
  if (data.settings) p.g = data.settings;
  return p;
}

export async function encodeSync(payload) {
  return encodeTransferString(JSON.stringify(payload));
}
export async function decodeSync(str) {
  const obj = JSON.parse(await decodeTransferString(str));
  if (!obj || obj.v !== 1) throw new Error('未対応のデータ形式です');
  return obj;
}

// 発行からの経過ミリ秒（t が無い旧データは null）
export function syncAgeMs(payload) {
  return payload && payload.t ? Date.now() - payload.t * 1000 : null;
}
// 発行から5分を過ぎていれば期限切れ（t が無い旧データは期限切れ扱いにしない）
export function isSyncExpired(payload) {
  const age = syncAgeMs(payload);
  return age != null && age > SYNC_TTL_MS;
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

// スキャン／貼り付けした文字列（URL）から #sync=… のエンコード値を取り出す。
// 受け渡し用でなければ空文字を返す。
export function extractSyncCode(text) {
  if (!text) return '';
  const m = String(text).match(/[#?&]sync=([^&#\s]+)/);
  return m ? m[1] : '';
}
