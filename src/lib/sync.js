// 端末間の進捗の受け渡し（QR／URLハッシュ）。
// 問題バンク・画像・音声ファイルは含めない（受け取り側で同梱分が再生成されるため軽量に保つ）。
//
// 符号化は src/lib/transferCodec.js（圧縮＋効率的なbase64url化）に委譲する。
// 大きなデータは src/lib/chunk.js で分割し、複数のQR／テキストブロックに分けて送れる。

import { encodeTransferString, decodeTransferString } from './transferCodec.js';
import { parseChunk } from './chunk.js';

// 受け渡し（QR／URL）の有効期限：発行から5分間だけ使える（安全のため）
export const SYNC_TTL_MS = 5 * 60 * 1000;

// 解答履歴の要約（軽量バックアップオプション）：直近90日は1件ずつそのまま残し、
// それより前は「日付×科目×正誤」で件数集計にまとめて件数を大きく減らす。
// QRなど容量が厳しい転送方式向けの近似（問題ごとの詳細は失われる）。
export const HISTORY_SUMMARY_CUTOFF_MS = 90 * 24 * 60 * 60 * 1000;

export function summarizeHistoryForTransfer(history, now = Date.now()) {
  const cutoff = now - HISTORY_SUMMARY_CUTOFF_MS;
  const recent = [];
  const buckets = new Map(); // `${day}|${subject}|${correct}` -> count
  for (const e of history) {
    if (!e || e.at == null) continue;
    if (e.at >= cutoff) { recent.push(e); continue; }
    // 日付は端末の日付で区切る（UTCだと日本時間の朝9時前の解答が前の日に入っていた）
    const dt = new Date(e.at);
    const day = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const key = `${day}|${e.subject || ''}|${e.correct ? 1 : 0}`;
    buckets.set(key, (buckets.get(key) || 0) + (Number.isFinite(Number(e.n)) && Number(e.n) > 0 ? Number(e.n) : 1));
  }
  const aggregated = [];
  for (const [key, n] of buckets) {
    const [day, subject, correctFlag] = key.split('|');
    aggregated.push({
      at: new Date(`${day}T00:00:00`).getTime(),
      ...(subject ? { subject } : {}),
      correct: correctFlag === '1',
      n,
    });
  }
  return [...aggregated, ...recent].sort((a, b) => a.at - b.at);
}

// バックアップ全体 → 軽量ペイロード（キーを短縮して容量節約）
export function buildSyncPayload(data, { includeHistory = true, summarizeHistory = false } = {}) {
  // t = 発行時刻（秒）。受け取り側で5分以内かどうかを判定する。
  const p = { v: 1, t: Math.floor(Date.now() / 1000) };
  if (data.srs && Object.keys(data.srs).length) p.s = data.srs;
  if (includeHistory && Array.isArray(data.history) && data.history.length) {
    p.h = summarizeHistory ? summarizeHistoryForTransfer(data.history) : data.history;
  }
  if (data.memos && Object.keys(data.memos).length) p.m = data.memos;
  if (data.links && Object.keys(data.links).length) p.l = data.links;
  if (Array.isArray(data.examResults) && data.examResults.length) p.e = data.examResults;
  if (data.settings) p.g = data.settings;
  if (data.bookmarks && Object.keys(data.bookmarks).length) p.b = data.bookmarks;
  // 語呂合わせ（自分で書いたもの）。以前は入っておらず、QRで機種変更すると消えていた
  if (data.kwMeta && Object.keys(data.kwMeta).length) p.k = data.kwMeta;
  // 「前回の続きから」（一問一答・復習・模試・音声・学習セッション）
  if (data.quizProgress) p.q = data.quizProgress;
  if (data.reviewProgress) p.r = data.reviewProgress;
  if (data.examProgress) p.x = data.examProgress;
  if (data.audioProgress) p.a = data.audioProgress;
  if (data.session) p.n = data.session;
  // 用語集（目次・索引）：候補フローで増える実データ（同梱データの再生成では復元できない）
  if (Array.isArray(data.glossaryExtra) && data.glossaryExtra.length) p.ge = data.glossaryExtra;
  if (Array.isArray(data.glossaryRemovedIds) && data.glossaryRemovedIds.length) p.gi = data.glossaryRemovedIds;
  if (Array.isArray(data.tocCandidates) && data.tocCandidates.length) p.tc = data.tocCandidates;
  if (Array.isArray(data.tocHistory) && data.tocHistory.length) p.th = data.tocHistory;
  if (data.flashcardSrs && Object.keys(data.flashcardSrs).length) p.fc = data.flashcardSrs;
  if (Array.isArray(data.pronunciationReportLog) && data.pronunciationReportLog.length) p.pr = data.pronunciationReportLog;
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
  if (p.b) b.bookmarks = p.b;
  if (p.k) b.kwMeta = p.k;
  if (p.q) b.quizProgress = p.q;
  if (p.r) b.reviewProgress = p.r;
  if (p.x) b.examProgress = p.x;
  if (p.a) b.audioProgress = p.a;
  if (p.n) b.session = p.n;
  if (p.ge) b.glossaryExtra = p.ge;
  if (p.gi) b.glossaryRemovedIds = p.gi;
  if (p.tc) b.tocCandidates = p.tc;
  if (p.th) b.tocHistory = p.th;
  if (p.fc) b.flashcardSrs = p.fc;
  if (p.pr) b.pronunciationReportLog = p.pr;
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

// ---- カメラで読み取った URL（#sync=…）を組み立てる ----
// アプリが出す QR／URL は分割の形式（{転送id}.{何枚目}.{全何枚}.{データ}）。以前は URL を開いた時に
// この形式を読めず、何も取り込まないまま黙っていた（2026-11-25、2台で動かして見つけた）。
// 複数枚に分かれている時は、カメラで1枚読むたびに新しいタブで開かれるので、端末の中（localStorage。
// 'shinkyu:' で始めない＝バックアップに入れない）に集めて、揃ったら返す。
export const URL_CHUNK_KEY = 'syncUrlChunks';
const URL_CHUNK_TTL_MS = SYNC_TTL_MS * 2;
// 戻り値：{ encoded }（揃った・分割でない）／{ partial: { received, total } }／{ error }
export function collectUrlChunk(code, store, now = Date.now()) {
  const text = String(code || '').trim();
  if (!text) return { error: '空のデータです' };
  const chunk = parseChunk(text);
  if (!chunk) return { encoded: text }; // 分割していない古い形式
  if (chunk.of === 1) return { encoded: chunk.data };
  let saved = null;
  try { saved = JSON.parse(store.get(URL_CHUNK_KEY) || 'null'); } catch (e) { saved = null; }
  if (!saved || saved.id !== chunk.transferId || saved.of !== chunk.of || now - (saved.at || 0) > URL_CHUNK_TTL_MS) {
    saved = { id: chunk.transferId, of: chunk.of, at: now, parts: {} };
  }
  saved.parts[chunk.part] = chunk.data;
  const received = Object.keys(saved.parts).length;
  if (received < chunk.of) {
    try { store.set(URL_CHUNK_KEY, JSON.stringify(saved)); } catch (e) { /* noop */ }
    return { partial: { received, total: chunk.of } };
  }
  try { store.remove(URL_CHUNK_KEY); } catch (e) { /* noop */ }
  let out = '';
  for (let i = 1; i <= chunk.of; i++) out += saved.parts[i];
  return { encoded: out };
}
